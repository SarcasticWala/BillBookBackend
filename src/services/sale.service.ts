import { Types } from "mongoose";
import { SaleInvoice } from "../models/SaleInvoice";
import { Party } from "../models/Party";
import { ApiError } from "../utils/ApiError";
import { getPaging } from "../utils/pagination";
import { withId, withIds } from "../utils/serialize";
import { applyStockDelta, computeStatus, InvoiceItemRow } from "./invoice.shared";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function createSale(userId: Types.ObjectId, body: Record<string, any>) {
  const rows: InvoiceItemRow[] = Array.isArray(body.itemDetails) ? body.itemDetails : [];
  if (!body.partyId) throw new ApiError(400, "partyId is required");
  if (!rows.length) throw new ApiError(400, "At least one item is required");

  const party = await Party.findOne({ _id: body.partyId, user: userId }).lean();
  if (!party) throw new ApiError(404, "Party not found");

  const grand = num(body.totalSaleAmount);
  const received = num(body.receivedAmount);
  const dueAmount = body.dueAmount != null ? num(body.dueAmount) : Math.max(0, grand - received);

  const invoice = await SaleInvoice.create({
    ...body,
    user: userId,
    partyId: party._id,
    partyName: party.partyName,
    dueAmount,
    status: computeStatus(dueAmount, received),
  });

  // A sale ships stock out and increases what the customer owes us.
  await applyStockDelta(userId, rows, -1);
  if (dueAmount > 0) {
    await Party.updateOne({ _id: party._id }, { $inc: { balance: dueAmount } });
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

  const grand = num(body.totalSaleAmount);
  const received = num(body.receivedAmount);
  const dueAmount =
    body.dueAmount != null ? num(body.dueAmount) : Math.max(0, grand - received);

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
  await applyStockDelta(userId, rows, -1);
  if (dueAmount > 0) {
    await Party.updateOne({ _id: party._id }, { $inc: { balance: dueAmount } });
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
