import { Schema, model, Types, InferSchemaType } from "mongoose";

/**
 * Stores the frontend's sale payload faithfully. itemDetails rows are rich and
 * computed client-side, so they're kept as Mixed. `strict: false` lets any
 * extra client fields persist and round-trip unchanged.
 */
const saleInvoiceSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    partyId: { type: Schema.Types.ObjectId, ref: "Party", required: true },
    partyName: { type: String, default: "" },

    invioceNo: { type: String, required: true }, // spelling matches frontend
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

    status: {
      type: String,
      enum: ["PAID", "PARTIAL", "UNPAID", "VOID"],
      default: "UNPAID",
    },
    notes: { type: String, default: "" },
    termsAndConditions: { type: String, default: "" },

    // GST e-Invoicing (IRP submission). Every existing/new invoice defaults
    // to NOT_APPLICABLE and is simply never touched unless it's eligible
    // (B2B/export/SEZ party) and the business has e-invoicing enabled.
    eInvoice: {
      status: {
        type: String,
        enum: ["NOT_APPLICABLE", "PENDING", "GENERATED", "FAILED", "CANCELLED"],
        default: "NOT_APPLICABLE",
      },
      irn: { type: String, default: "" },
      ackNo: { type: String, default: "" },
      ackDate: { type: Date, default: null },
      signedQrCode: { type: String, default: "" },
      generatedAt: { type: Date, default: null },
      cancelledAt: { type: Date, default: null },
      cancelReason: { type: String, default: "" },
      error: { type: String, default: "" },
    },
  },
  { timestamps: true, strict: false }
);

saleInvoiceSchema.index({ user: 1, createdAt: -1 });
saleInvoiceSchema.index({ user: 1, invioceNo: 1 }, { unique: true });
// The e-Invoice sweep's due-invoices query.
saleInvoiceSchema.index({ "eInvoice.status": 1, createdAt: -1 });

export type SaleInvoiceDoc = InferSchemaType<typeof saleInvoiceSchema> & {
  _id: Types.ObjectId;
};
export const SaleInvoice = model("SaleInvoice", saleInvoiceSchema);
