import { Schema, model, Types, InferSchemaType } from "mongoose";

/**
 * A money account (cash-in-hand or a bank account) that Cash & Bank tracks.
 * `balance` is the running balance: opening balance + all money movements.
 */
const accountSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["CASH", "BANK"], default: "BANK" },
    openingBalance: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    bankName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    upiId: { type: String, default: "" },
    // The auto-created "Cash" account cannot be deleted.
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

accountSchema.index({ user: 1, createdAt: -1 });

export type AccountDoc = InferSchemaType<typeof accountSchema> & {
  _id: Types.ObjectId;
};
export const Account = model("Account", accountSchema);
