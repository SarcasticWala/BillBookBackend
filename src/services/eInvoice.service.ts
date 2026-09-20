import { Types } from "mongoose";
import { SaleInvoice } from "../models/SaleInvoice";
import { Party } from "../models/Party";
import { User } from "../models/User";
import { ApiError } from "../utils/ApiError";
import { withId, withIds } from "../utils/serialize";
import { isPartyEInvoiceEligible } from "../utils/eInvoiceEligibility";
import { getIrpAdapter, IrpInvoicePayload } from "./irp";
import { logger } from "../config/logger";

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;
// Only sweep recent invoices — old unpaid/void invoices from before
// e-invoicing was ever enabled shouldn't suddenly get IRNs years later.
const SWEEP_LOOKBACK_MS = 35 * 24 * 60 * 60 * 1000;

export async function setEInvoicingEnabled(userId: Types.ObjectId, enabled: boolean) {
  const user = await User.findByIdAndUpdate(
    userId,
    { eInvoicingEnabled: enabled },
    { new: true }
  ).lean();
  if (!user) throw new ApiError(404, "User not found");
  return { eInvoicingEnabled: user.eInvoicingEnabled };
}

function buildPayload(
  invoice: { invioceNo: string; invioceDate: Date; itemDetails: any[]; totalSaleAmount: number; totalTaxableSaleAmount: number; totalTax: number },
  sellerGstin: string,
  buyerGstin: string | undefined
): IrpInvoicePayload {
  return {
    sellerGstin,
    buyerGstin,
    invoiceNumber: invoice.invioceNo,
    invoiceDate: invoice.invioceDate,
    totalTaxableValue: invoice.totalTaxableSaleAmount,
    totalTax: invoice.totalTax,
    grandTotal: invoice.totalSaleAmount,
    items: (invoice.itemDetails || []).map((r: any) => ({
      name: r.itemName || "Item",
      hsnCode: r.hsnCode,
      quantity: r.quantity || 1,
      taxableValue: r.pricePerItem || 0,
      taxAmount: r.taxAmount || 0,
    })),
  };
}

/**
 * The one path that actually calls the IRP. Idempotent via a compare-and-swap
 * lock on eInvoice.status: only one caller can ever move an invoice from
 * NOT_APPLICABLE/FAILED into PENDING, so a retry racing the scheduled sweep
 * (or a user double-clicking "Generate") can never request a second IRN for
 * the same invoice.
 */
export async function submitForEInvoice(userId: Types.ObjectId, invoiceId: string) {
  const invoice = await SaleInvoice.findOne({ _id: invoiceId, user: userId });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  if (invoice.status === "VOID") throw new ApiError(400, "A voided invoice cannot be e-invoiced");

  if (invoice.eInvoice?.status === "GENERATED") {
    return withId(invoice.toObject()); // Already has an IRN — nothing to do.
  }

  const [user, party] = await Promise.all([
    User.findById(userId).lean(),
    Party.findOne({ _id: invoice.partyId, user: userId }).lean(),
  ]);
  if (!user) throw new ApiError(404, "User not found");
  if (!user.eInvoicingEnabled) throw new ApiError(400, "e-Invoicing is not enabled for this business");
  if (!party) throw new ApiError(404, "Party not found");
  if (!isPartyEInvoiceEligible(party)) {
    throw new ApiError(400, "This invoice is B2C — e-Invoices are not required for B2C sales");
  }
  if (!user.gstin) throw new ApiError(400, "Add your business GSTIN in Settings before generating e-Invoices");

  // Compare-and-swap lock: only proceeds if nobody else has already claimed
  // this invoice for submission.
  const locked = await SaleInvoice.findOneAndUpdate(
    { _id: invoiceId, user: userId, "eInvoice.status": { $nin: ["PENDING", "GENERATED"] } },
    { $set: { "eInvoice.status": "PENDING", "eInvoice.error": "" } },
    { new: true }
  );
  if (!locked) {
    // Someone else's request already claimed it (or it finished in between).
    const current = await SaleInvoice.findOne({ _id: invoiceId, user: userId }).lean();
    return withId(current);
  }

  // Always present at runtime — the schema gives every sub-field a default,
  // so Mongoose materializes this nested doc on every SaleInvoice.
  const ei = locked.eInvoice!;

  try {
    const payload = buildPayload(locked, user.gstin, party.gstCategory === "DOMESTIC" ? party.gstNumber : undefined);
    const result = await getIrpAdapter().submitInvoice(payload);

    ei.status = "GENERATED";
    ei.irn = result.irn;
    ei.ackNo = result.ackNo;
    ei.ackDate = result.ackDate;
    ei.signedQrCode = result.signedQrCode;
    ei.generatedAt = new Date();
    ei.error = "";
    await locked.save();
  } catch (err: any) {
    ei.status = "FAILED";
    ei.error = err?.message || "Submission failed";
    await locked.save();
  }

  return withId(locked.toObject());
}

export async function cancelEInvoice(userId: Types.ObjectId, invoiceId: string, reason: string) {
  const invoice = await SaleInvoice.findOne({ _id: invoiceId, user: userId });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  if (invoice.eInvoice?.status !== "GENERATED") {
    throw new ApiError(400, "This invoice does not have an active e-Invoice to cancel");
  }
  const generatedAt = invoice.eInvoice.generatedAt ? new Date(invoice.eInvoice.generatedAt) : null;
  if (!generatedAt || Date.now() - generatedAt.getTime() > CANCEL_WINDOW_MS) {
    throw new ApiError(
      400,
      "The 24-hour IRP cancellation window has passed — issue a credit note instead"
    );
  }

  await getIrpAdapter().cancelInvoice(invoice.eInvoice.irn, reason);

  invoice.eInvoice.status = "CANCELLED";
  invoice.eInvoice.cancelledAt = new Date();
  invoice.eInvoice.cancelReason = reason || "";
  await invoice.save();
  return withId(invoice.toObject());
}

/** Scheduler sweep: every eligible, not-yet-generated invoice gets one attempt. */
export async function runEInvoiceSweep(): Promise<void> {
  const enabledUsers = await User.find({ eInvoicingEnabled: true }, { _id: 1 }).lean();
  if (!enabledUsers.length) return;
  const userIds = enabledUsers.map((u) => u._id);

  const candidates = await SaleInvoice.find({
    user: { $in: userIds },
    status: { $ne: "VOID" },
    "eInvoice.status": { $in: ["NOT_APPLICABLE", "FAILED"] },
    createdAt: { $gte: new Date(Date.now() - SWEEP_LOOKBACK_MS) },
  })
    .select("_id user partyId")
    .lean();

  if (!candidates.length) return;

  const partyIds = [...new Set(candidates.map((c) => String(c.partyId)))];
  const parties = await Party.find({ _id: { $in: partyIds } }).lean();
  const partyById = new Map(parties.map((p) => [String(p._id), p]));

  for (const c of candidates) {
    const party = partyById.get(String(c.partyId));
    if (!party || !isPartyEInvoiceEligible(party)) continue; // stays NOT_APPLICABLE — correctly never touched
    try {
      await submitForEInvoice(c.user as Types.ObjectId, String(c._id));
    } catch (err) {
      logger.error({ err, invoiceId: c._id }, "[e-invoice] sweep submission failed");
    }
  }
}

/** Lightweight GSTR-1 feed — invoice-wise B2B data for a given month, not a filing UI. */
export async function gstr1Summary(userId: Types.ObjectId, month: string) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) throw new ApiError(400, "month must be in YYYY-MM format");
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  const invoices = await SaleInvoice.find({
    user: userId,
    status: { $ne: "VOID" },
    "eInvoice.status": "GENERATED",
    invioceDate: { $gte: start, $lt: end },
  })
    .populate("partyId", "partyName gstNumber")
    .lean();

  return withIds(invoices).map((inv: any) => ({
    invioceNo: inv.invioceNo,
    invioceDate: inv.invioceDate,
    partyName: inv.partyId?.partyName,
    buyerGstin: inv.partyId?.gstNumber,
    taxableValue: inv.totalTaxableSaleAmount,
    tax: inv.totalTax,
    grandTotal: inv.totalSaleAmount,
    irn: inv.eInvoice?.irn,
  }));
}
