import { Types } from "mongoose";
import { BusinessDocument, DOCUMENT_TYPES } from "../models/Document";
import { Party } from "../models/Party";
import { ApiError } from "../utils/ApiError";
import { getPaging } from "../utils/pagination";
import { withId, withIds } from "../utils/serialize";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function computeItems(rawItems: any[]) {
  let subTotal = 0;
  let totalTax = 0;
  const items = (Array.isArray(rawItems) ? rawItems : []).map((r) => {
    const quantity = num(r.quantity);
    const price = num(r.price);
    const taxRate = num(r.taxRate);
    const amount = round2(quantity * price);
    const taxAmount = round2((amount * taxRate) / 100);
    const total = round2(amount + taxAmount);
    subTotal += amount;
    totalTax += taxAmount;
    return {
      itemId: r.itemId || null,
      name: r.name || "",
      quantity,
      price,
      taxRate,
      amount,
      taxAmount,
      total,
    };
  });
  subTotal = round2(subTotal);
  totalTax = round2(totalTax);
  return { items, subTotal, totalTax, grandTotal: round2(subTotal + totalTax) };
}

function assertType(type: string) {
  if (!(DOCUMENT_TYPES as readonly string[]).includes(type)) {
    throw new ApiError(400, "Invalid document type");
  }
}

export async function createDocument(
  userId: Types.ObjectId,
  type: string,
  body: Record<string, any>
) {
  assertType(type);
  if (!body.partyId) throw new ApiError(400, "Party is required");
  if (!body.docNo) throw new ApiError(400, "Document number is required");
  const rows = Array.isArray(body.items) ? body.items : [];
  if (!rows.length) throw new ApiError(400, "At least one item is required");

  const party = await Party.findOne({ _id: body.partyId, user: userId }).lean();
  if (!party) throw new ApiError(404, "Party not found");

  const totals = computeItems(rows);
  const doc = await BusinessDocument.create({
    user: userId,
    type,
    docNo: body.docNo,
    docDate: body.docDate ? new Date(body.docDate) : new Date(),
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
    partyId: party._id,
    partyName: party.partyName,
    ...totals,
    notes: body.notes || "",
    status: body.status || "Open",
  });
  return withId(doc.toObject());
}

export async function listDocuments(
  userId: Types.ObjectId,
  type: string,
  query: Record<string, any>
) {
  assertType(type);
  const { limit, skip } = getPaging(query);
  const docs = await BusinessDocument.find({ user: userId, type })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("partyId", "partyName mobileNo")
    .lean();
  return withIds(docs);
}
