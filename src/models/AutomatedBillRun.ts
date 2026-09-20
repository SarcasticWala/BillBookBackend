import { Schema, model, Types, InferSchemaType } from "mongoose";

/**
 * One history row per (template, billing period) — the audit trail (which
 * invoice came from which template, and when) and, via its unique index,
 * the exactly-once guarantee: a scheduler retry or duplicate tick for a
 * period that already has a row collides on insert instead of generating
 * a second invoice.
 */
const automatedBillRunSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    template: {
      type: Schema.Types.ObjectId,
      ref: "AutomatedBillTemplate",
      required: true,
    },
    period: { type: String, required: true },

    status: {
      type: String,
      enum: ["PENDING_REVIEW", "POSTED", "FAILED", "CANCELLED"],
      default: "PENDING_REVIEW",
    },
    // The would-be invoice payload, held here until a human posts it
    // (only populated when the template is not auto-post).
    snapshot: { type: Schema.Types.Mixed, default: null },
    invoiceId: { type: Schema.Types.ObjectId, ref: "SaleInvoice", default: null },
    error: { type: String, default: "" },
    postedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

automatedBillRunSchema.index({ template: 1, period: 1 }, { unique: true });
automatedBillRunSchema.index({ user: 1, createdAt: -1 });

export type AutomatedBillRunDoc = InferSchemaType<typeof automatedBillRunSchema> & {
  _id: Types.ObjectId;
};
export const AutomatedBillRun = model("AutomatedBillRun", automatedBillRunSchema);
