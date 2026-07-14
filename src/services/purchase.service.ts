import { Types } from "mongoose";
import { PurchaseInvoice } from "../models/PurchaseInvoice";
import { Party } from "../models/Party";
import { ApiError } from "../utils/ApiError";
import { getPaging } from "../utils/pagination";
import { withId, withIds } from "../utils/serialize";
import { applyStockDelta, computeStatus, InvoiceItemRow } from "./invoice.shared";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function createPurchase(userId: Types.ObjectId, body: Record<string, any>) {
  const rows: InvoiceItemRow[] = Array.isArray(body.itemDetails) ? body.itemDetails : [];
  if (!body.partyId) throw new ApiError(400, "partyId is required");
  if (!rows.length) throw new ApiError(400, "At least one item is required");

  const party = await Party.findOne({ _id: body.partyId, user: userId }).lean();
  if (!party) throw new ApiError(404, "Party (supplier) not found");

  const grand = num(body.totalSaleAmount);
  const received = num(body.receivedAmount);
  const dueAmount = body.dueAmount != null ? num(body.dueAmount) : Math.max(0, grand - received);

  const invoice = await PurchaseInvoice.create({
    ...body,
    user: userId,
    partyId: party._id,
    partyName: party.partyName,
    dueAmount,
    status: computeStatus(dueAmount, received),
  });

  // A purchase brings stock in and increases what we owe the supplier.
  await applyStockDelta(userId, rows, 1);
  if (dueAmount > 0) {
    await Party.updateOne({ _id: party._id }, { $inc: { balance: -dueAmount } });
  }

  return withId(invoice.toObject());
}

export async function listPurchaseInvoices(
  userId: Types.ObjectId,
  query: Record<string, any>
) {
  const { limit, skip } = getPaging(query);
  const invoices = await PurchaseInvoice.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("partyId", "partyName mobileNo gstNumber")
    .lean();
  return withIds(invoices);
}
