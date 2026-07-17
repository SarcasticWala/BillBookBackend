import { Schema, model, Types, InferSchemaType } from "mongoose";

/** A business expense recorded by the user (rent, utilities, supplies, etc.). */
const expenseSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expenseNumber: { type: String, required: true },
    expenseDate: { type: Date, default: Date.now },
    category: { type: String, default: "" },
    partyName: { type: String, default: "" },
    amount: { type: Number, required: true },
    paymentMode: { type: String, default: "CASH" }, // CASH | BANK | UPI | CARD
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

expenseSchema.index({ user: 1, createdAt: -1 });

export type ExpenseDoc = InferSchemaType<typeof expenseSchema> & {
  _id: Types.ObjectId;
};
export const Expense = model("Expense", expenseSchema);
