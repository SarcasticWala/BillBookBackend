import { Schema, model, Types, InferSchemaType } from "mongoose";

/**
 * A single money movement on an account.
 * IN / OUT      → add or reduce money directly.
 * TRANSFER_IN / TRANSFER_OUT → the two legs of a transfer between accounts
 *                 (`counterparty` points at the other account).
 */
const accountTransactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    account: { type: Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    type: {
      type: String,
      enum: ["IN", "OUT", "TRANSFER_IN", "TRANSFER_OUT"],
      required: true,
    },
    amount: { type: Number, required: true },
    description: { type: String, default: "" },
    counterparty: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

accountTransactionSchema.index({ user: 1, createdAt: -1 });

export type AccountTransactionDoc = InferSchemaType<
  typeof accountTransactionSchema
> & { _id: Types.ObjectId };
export const AccountTransaction = model(
  "AccountTransaction",
  accountTransactionSchema
);
