import { Schema, model, Types, InferSchemaType } from "mongoose";

// Mirrors SaleInvoice; stores the frontend's purchase payload faithfully.
const purchaseInvoiceSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    partyId: { type: Schema.Types.ObjectId, ref: "Party", required: true },
    partyName: { type: String, default: "" },

    invioceNo: { type: String, required: true },
    invioceDate: { type: Date, default: Date.now },
    paymentTermDays: { type: Number, default: 0 },
    dueDate: { type: Date, default: null },

    itemDetails: { type: [Schema.Types.Mixed], default: [] },

    totalSaleAmount: { type: Number, default: 0 },
    totalTaxableSaleAmount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    additionalCharges: { type: Number, default: 0 },
    discountAfterTax: { type: Number, default: 0 },
    receivedAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    isFullyPaid: { type: Boolean, default: false },
    cash: { type: Number, default: 0 },
    online: { type: Number, default: 0 },

    status: { type: String, enum: ["PAID", "PARTIAL", "UNPAID"], default: "UNPAID" },
    notes: { type: String, default: "" },
    termsAndConditions: { type: String, default: "" },
  },
  { timestamps: true, strict: false }
);

purchaseInvoiceSchema.index({ user: 1, createdAt: -1 });
purchaseInvoiceSchema.index({ user: 1, invioceNo: 1 }, { unique: true });

export type PurchaseInvoiceDoc = InferSchemaType<typeof purchaseInvoiceSchema> & {
  _id: Types.ObjectId;
};
export const PurchaseInvoice = model("PurchaseInvoice", purchaseInvoiceSchema);
