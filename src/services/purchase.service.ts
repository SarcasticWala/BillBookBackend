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

export async function listPurchaseInvoicesPaged(
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
    PurchaseInvoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("partyId", "partyName mobileNo gstNumber")
      .lean(),
    PurchaseInvoice.countDocuments(filter),
    PurchaseInvoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalPurchaseAmount" },
          paid: { $sum: "$paidAmount" },
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

export async function getPurchaseInvoice(userId: Types.ObjectId, id: string) {
  const invoice = await PurchaseInvoice.findOne({ _id: id, user: userId })
    .populate(
      "partyId",
      "partyName mobileNo gstNumber panNumber email billingAddressData shippingAddressData"
    )
    .lean();
  if (!invoice) throw new ApiError(404, "Purchase invoice not found");
  return withId(invoice);
}

export async function updatePurchase(
  userId: Types.ObjectId,
  id: string,
  body: Record<string, any>
) {
  const existing = await PurchaseInvoice.findOne({ _id: id, user: userId });
  if (!existing) throw new ApiError(404, "Purchase invoice not found");

  const rows: InvoiceItemRow[] = Array.isArray(body.itemDetails) ? body.itemDetails : [];
  if (!body.partyId) throw new ApiError(400, "partyId is required");
  if (!rows.length) throw new ApiError(400, "At least one item is required");

  const party = await Party.findOne({ _id: body.partyId, user: userId }).lean();
  if (!party) throw new ApiError(404, "Party (supplier) not found");

  // Reverse the previous invoice's effects: stock out, and give back what we owed.
  const oldRows = (existing.itemDetails as InvoiceItemRow[]) || [];
  await applyStockDelta(userId, oldRows, -1);
  if (existing.dueAmount > 0) {
    await Party.updateOne(
      { _id: existing.partyId },
      { $inc: { balance: existing.dueAmount } }
    );
  }

  const grand = num(body.totalPurchaseAmount ?? body.totalSaleAmount);
  const received = num(body.receivedAmount ?? body.paidAmount);
  const dueAmount =
    body.dueAmount != null ? num(body.dueAmount) : Math.max(0, grand - received);

  // Strip identity fields so a round-tripped payload can't clobber them.
  const { id: _drop, _id: _drop2, user: _drop3, ...clean } = body;
  existing.set({
    ...clean,
    partyId: party._id,
    partyName: party.partyName,
    dueAmount,
    status: computeStatus(dueAmount, received),
  });
  await existing.save();

  // Re-apply the new payload's effects.
  await applyStockDelta(userId, rows, 1);
  if (dueAmount > 0) {
    await Party.updateOne({ _id: party._id }, { $inc: { balance: -dueAmount } });
  }

  return withId(existing.toObject());
}

export async function deletePurchase(userId: Types.ObjectId, id: string) {
  const existing = await PurchaseInvoice.findOne({ _id: id, user: userId });
  if (!existing) throw new ApiError(404, "Purchase invoice not found");

  const oldRows = (existing.itemDetails as InvoiceItemRow[]) || [];
  await applyStockDelta(userId, oldRows, -1);
  if (existing.dueAmount > 0) {
    await Party.updateOne(
      { _id: existing.partyId },
      { $inc: { balance: existing.dueAmount } }
    );
  }
  await existing.deleteOne();
  return { id };
}
