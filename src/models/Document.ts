import { Schema, model, Types, InferSchemaType } from "mongoose";

/**
 * Generic business document (invoice-like) keyed by `type`, covering
 * quotations, proforma invoices, credit/debit notes, sales/purchase returns,
 * and purchase orders. Shares one shape so all create flows reuse one model.
 */
export const DOCUMENT_TYPES = [
  "QUOTATION",
  "PROFORMA",
  "CREDIT_NOTE",
  "SALES_RETURN",
  "PURCHASE_ORDER",
  "PURCHASE_RETURN",
  "DEBIT_NOTE",
] as const;

const documentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: DOCUMENT_TYPES, required: true, index: true },

    docNo: { type: String, required: true },
    docDate: { type: Date, default: Date.now },
    dueDate: { type: Date, default: null },

    partyId: { type: Schema.Types.ObjectId, ref: "Party", required: true },
    partyName: { type: String, default: "" },

    items: { type: [Schema.Types.Mixed], default: [] },

    subTotal: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    status: { type: String, default: "Open" },
  },
  { timestamps: true }
);

documentSchema.index({ user: 1, type: 1, createdAt: -1 });
documentSchema.index({ user: 1, type: 1, docNo: 1 }, { unique: true });

export type DocumentDoc = InferSchemaType<typeof documentSchema> & {
  _id: Types.ObjectId;
};
export const BusinessDocument = model("Document", documentSchema);
