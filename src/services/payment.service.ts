import { Types } from "mongoose";
import { Payment, PAYMENT_TYPES } from "../models/Payment";
import { Party } from "../models/Party";
import { ApiError } from "../utils/ApiError";
import { getPaging } from "../utils/pagination";
import { withId, withIds } from "../utils/serialize";
import { paymentBalanceDelta, type PaymentType } from "../utils/partyBalance";
import { logger } from "../config/logger";

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

  // Keep `Party.balance` in step with the payment, the same way sale and
  // purchase invoices already do. This was the gap behind BR-09 / PAY-03:
  // invoices maintained the running balance but a standalone Payment never
  // did, so the stored field — which the Dashboard's To Collect / To Pay
  // reads directly — overstated what a party actually owed as soon as they
  // paid anything. Written after the Payment row so a failed insert can't
  // move the balance; the reverse order would lose money on a partial write.
  //
  // These are two writes without a transaction, matching how sale.service and
  // purchase.service already do it (Mongo transactions need a replica set,
  // which local dev doesn't run). So the second write can fail on its own.
  // When it does, the Payment row is the record that matters and it is already
  // safely stored — `Party.balance` is only a cache of it. Failing the whole
  // request here would be the worse outcome: the caller would retry and book
  // the same payment twice. Log it loudly instead and let the reconciliation
  // script repair the cache; that is precisely what it exists for.
  try {
    await Party.updateOne(
      { _id: party._id, user: userId },
      { $inc: { balance: paymentBalanceDelta(type as PaymentType, amount) } }
    );
  } catch (err) {
    logger.error(
      {
        err,
        paymentId: String(payment._id),
        partyId: String(party._id),
        userId: String(userId),
        remedy: "npm run reconcile:balances",
      },
      "Payment stored but Party.balance update failed — balance is stale for this party until reconciled"
    );
  }

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
