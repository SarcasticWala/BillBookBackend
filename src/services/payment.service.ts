import { Types } from "mongoose";
import { Payment, PAYMENT_TYPES } from "../models/Payment";
import { Party } from "../models/Party";
import { ApiError } from "../utils/ApiError";
import { getPaging } from "../utils/pagination";
import { withId, withIds } from "../utils/serialize";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function assertType(type: string) {
  if (!(PAYMENT_TYPES as readonly string[]).includes(type)) {
    throw new ApiError(400, "Invalid payment type");
  }
}

export async function createPayment(
  userId: Types.ObjectId,
  type: string,
  body: Record<string, any>
) {
  assertType(type);
  if (!body.partyId) throw new ApiError(400, "Party is required");
  const amount = num(body.amount);
  if (amount <= 0) throw new ApiError(400, "Amount must be greater than 0");

  const party = await Party.findOne({ _id: body.partyId, user: userId }).lean();
  if (!party) throw new ApiError(404, "Party not found");

  const payment = await Payment.create({
    user: userId,
    type,
    paymentNo: body.paymentNo || `PAY-${Date.now()}`,
    paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
    partyId: party._id,
    partyName: party.partyName,
    amount,
    mode: body.mode || "CASH",
    reference: body.reference || "",
    notes: body.notes || "",
  });
  return withId(payment.toObject());
}

export async function listPayments(
  userId: Types.ObjectId,
  type: string,
  query: Record<string, any>
) {
  assertType(type);
  const { limit, skip } = getPaging(query);
  const payments = await Payment.find({ user: userId, type })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("partyId", "partyName mobileNo")
    .lean();
  return withIds(payments);
}
