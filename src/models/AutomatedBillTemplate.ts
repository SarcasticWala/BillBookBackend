import { Schema, model, Types, InferSchemaType } from "mongoose";
import { BILL_FREQUENCIES } from "../utils/recurrence";

/**
 * A recurring-bill blueprint. The scheduler (automatedBill.service.ts)
 * generates an ordinary SaleInvoice from this on each due date — the
 * template itself is never an invoice.
 */
const automatedBillTemplateSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    partyId: { type: Schema.Types.ObjectId, ref: "Party", required: true },
    partyName: { type: String, default: "" },

    itemDetails: { type: [Schema.Types.Mixed], default: [] },
    additionalCharges: { type: Number, default: 0 },
    discountAfterTax: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    termsAndConditions: { type: String, default: "" },

    frequency: { type: String, enum: BILL_FREQUENCIES, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    occurrenceCount: { type: Number, default: null },
    occurrencesGenerated: { type: Number, default: 0 },

    // false (default) = each generated invoice waits as a draft for manual
    // review before it becomes a real, posted SaleInvoice.
    autoPost: { type: Boolean, default: false },

    nextRunDate: { type: Date, required: true },
    lastRunAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ["ACTIVE", "PAUSED", "CANCELLED", "COMPLETED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true }
);

automatedBillTemplateSchema.index({ user: 1, createdAt: -1 });
// The scheduler's due-templates query.
automatedBillTemplateSchema.index({ status: 1, nextRunDate: 1 });

export type AutomatedBillTemplateDoc = InferSchemaType<
  typeof automatedBillTemplateSchema
> & { _id: Types.ObjectId };
export const AutomatedBillTemplate = model(
  "AutomatedBillTemplate",
  automatedBillTemplateSchema
);
