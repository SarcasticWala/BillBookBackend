import { Schema, model, Types, InferSchemaType } from "mongoose";

export const PAYMENT_TYPES = ["PAYMENT_IN", "PAYMENT_OUT"] as const;

const paymentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: PAYMENT_TYPES, required: true, index: true },

    paymentNo: { type: String, required: true },
    paymentDate: { type: Date, default: Date.now },

    partyId: { type: Schema.Types.ObjectId, ref: "Party", required: true },
    partyName: { type: String, default: "" },

    amount: { type: Number, required: true },
    mode: { type: String, default: "CASH" }, // CASH | BANK | UPI | CHEQUE
    reference: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, type: 1, createdAt: -1 });
paymentSchema.index({ user: 1, type: 1, paymentNo: 1 }, { unique: true });

export type PaymentDoc = InferSchemaType<typeof paymentSchema> & {
  _id: Types.ObjectId;
};
export const Payment = model("Payment", paymentSchema);
