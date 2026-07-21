import { Types } from "mongoose";
import { SaleInvoice } from "../models/SaleInvoice";
import { Party } from "../models/Party";
import { ApiError } from "../utils/ApiError";
import { getPaging } from "../utils/pagination";
import { withId, withIds } from "../utils/serialize";
import {
  applyStockDelta,
  computeStatus,
  computeInvoiceTotals,
  InvoiceItemRow,
} from "./invoice.shared";

/** Reject a duplicate invoice number for this business (optionally ignoring one id). */
async function assertInvoiceNoUnique(
  userId: Types.ObjectId,
  invioceNo: string,
  ignoreId?: Types.ObjectId
) {
  if (!invioceNo) return;
  const filter: Record<string, any> = { user: userId, invioceNo };
  if (ignoreId) filter._id = { $ne: ignoreId };
  const dup = await SaleInvoice.findOne(filter).lean();
  if (dup) throw new ApiError(409, `Invoice number "${invioceNo}" already exists`);
}

export async function createSale(userId: Types.ObjectId, body: Record<string, any>) {
  const rows: InvoiceItemRow[] = Array.isArray(body.itemDetails) ? body.itemDetails : [];
  if (!body.partyId) throw new ApiError(400, "partyId is required");
  if (!rows.length) throw new ApiError(400, "At least one item is required");

  const invioceNo = String(body.invioceNo ?? "").trim();
  await assertInvoiceNoUnique(userId, invioceNo);

  const party = await Party.findOne({ _id: body.partyId, user: userId }).lean();
  if (!party) throw new ApiError(404, "Party not found");

  // Money is server-authoritative — re-derive from the line items, never the
  // client's top-level totals.
  const t = computeInvoiceTotals(rows, body, body.receivedAmount);

  const invoice = await SaleInvoice.create({
    ...body,
    user: userId,
    partyId: party._id,
    partyName: party.partyName,
    invioceNo,
    totalSaleAmount: t.grand,
    additionalCharges: t.additionalCharges,
    discountAfterTax: t.discountAfterTax,
    receivedAmount: t.paid,
    dueAmount: t.dueAmount,
    status: computeStatus(t.dueAmount, t.paid),
  });

  // A sale ships stock out and increases what the customer owes us.
  await applyStockDelta(userId, rows, -1);
  if (t.dueAmount > 0) {
    await Party.updateOne({ _id: party._id }, { $inc: { balance: t.dueAmount } });
  }

  return withId(invoice.toObject());
}

export async function listSaleInvoices(userId: Types.ObjectId, query: Record<string, any>) {
  const { limit, skip } = getPaging(query);
  const invoices = await SaleInvoice.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("partyId", "partyName mobileNo gstNumber")
    .lean();
  return withIds(invoices);
}

export async function listSaleInvoicesPaged(
  userId: Types.ObjectId,
  query: Record<string, any>
) {
  const { page, limit, skip } = getPaging(query);
  const filter: Record<string, any> = { user: userId };
  const search = String(query.search || "").trim();
  if (search) {
    filter.$or = [
      { invioceNo: { $regex: search, $options: "i" } },
      { partyName: { $regex: search, $options: "i" } },
    ];
  }

  const [docs, total, summaryAgg] = await Promise.all([
    SaleInvoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("partyId", "partyName mobileNo gstNumber")
      .lean(),
    SaleInvoice.countDocuments(filter),
    SaleInvoice.aggregate([
      // Voided invoices are excluded from the money totals.
      { $match: { ...filter, status: { $ne: "VOID" } } },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalSaleAmount" },
          paid: { $sum: "$receivedAmount" },
          due: { $sum: "$dueAmount" },
        },
      },
    ]),
  ]);

  const s = summaryAgg[0] || {};
  return {
    items: withIds(docs),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    summary: { total: s.total || 0, paid: s.paid || 0, due: s.due || 0 },
  };
}

export async function getSaleInvoice(userId: Types.ObjectId, id: string) {
  const invoice = await SaleInvoice.findOne({ _id: id, user: userId })
    .populate(
      "partyId",
      "partyName mobileNo gstNumber panNumber email billingAddressData shippingAddressData"
    )
    .lean();
  if (!invoice) throw new ApiError(404, "Sale invoice not found");
  return withId(invoice);
}

export async function updateSale(
  userId: Types.ObjectId,
  id: string,
  body: Record<string, any>
) {
  const existing = await SaleInvoice.findOne({ _id: id, user: userId });
  if (!existing) throw new ApiError(404, "Sale invoice not found");
  if (existing.status === "VOID")
    throw new ApiError(400, "A voided invoice cannot be edited");

  const rows: InvoiceItemRow[] = Array.isArray(body.itemDetails) ? body.itemDetails : [];
  if (!body.partyId) throw new ApiError(400, "partyId is required");
  if (!rows.length) throw new ApiError(400, "At least one item is required");

  const invioceNo = String(body.invioceNo ?? existing.invioceNo ?? "").trim();
  await assertInvoiceNoUnique(userId, invioceNo, existing._id);

  const party = await Party.findOne({ _id: body.partyId, user: userId }).lean();
  if (!party) throw new ApiError(404, "Party not found");

  // Reverse the previous invoice's effects: stock back in, and drop the receivable.
  const oldRows = (existing.itemDetails as InvoiceItemRow[]) || [];
  await applyStockDelta(userId, oldRows, 1);
  if (existing.dueAmount > 0) {
    await Party.updateOne(
      { _id: existing.partyId },
      { $inc: { balance: -existing.dueAmount } }
    );
  }

  // Server-authoritative money (see createSale).
  const t = computeInvoiceTotals(rows, body, body.receivedAmount);

  const { id: _drop, _id: _drop2, user: _drop3, ...clean } = body;
  existing.set({
    ...clean,
    partyId: party._id,
    partyName: party.partyName,
    invioceNo,
    totalSaleAmount: t.grand,
    additionalCharges: t.additionalCharges,
    discountAfterTax: t.discountAfterTax,
    receivedAmount: t.paid,
    dueAmount: t.dueAmount,
    status: computeStatus(t.dueAmount, t.paid),
  });
  await existing.save();

  // Re-apply the new payload's effects.
  await applyStockDelta(userId, rows, -1);
  if (t.dueAmount > 0) {
    await Party.updateOne({ _id: party._id }, { $inc: { balance: t.dueAmount } });
  }

  return withId(existing.toObject());
}

// Voiding keeps the record (audit trail) but reverses its stock and
// party-balance effects, so a voided invoice no longer counts anywhere.
export async function voidSale(userId: Types.ObjectId, id: string) {
  const existing = await SaleInvoice.findOne({ _id: id, user: userId });
  if (!existing) throw new ApiError(404, "Sale invoice not found");
  if (existing.status === "VOID")
    throw new ApiError(400, "Invoice is already voided");

  const oldRows = (existing.itemDetails as InvoiceItemRow[]) || [];
  await applyStockDelta(userId, oldRows, 1);
  if (existing.dueAmount > 0) {
    await Party.updateOne(
      { _id: existing.partyId },
      { $inc: { balance: -existing.dueAmount } }
    );
  }
  existing.set({ status: "VOID", dueAmount: 0 });
  await existing.save();
  return withId(existing.toObject());
}
