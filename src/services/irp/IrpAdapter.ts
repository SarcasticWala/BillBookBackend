/**
 * Provider-agnostic contract for whatever actually talks to the government's
 * e-invoice system — NIC direct, or a GSP, or (today) a mock. Swapping
 * providers is a one-line change in getIrpAdapter(); nothing that calls an
 * adapter needs to know which one it's talking to.
 */

export interface IrpInvoicePayload {
  /** Seller's own GSTIN. */
  sellerGstin: string;
  /** Buyer's GSTIN (absent for EXPORT). */
  buyerGstin?: string;
  invoiceNumber: string;
  invoiceDate: Date;
  totalTaxableValue: number;
  totalTax: number;
  grandTotal: number;
  items: Array<{ name: string; hsnCode?: string; quantity: number; taxableValue: number; taxAmount: number }>;
}

export interface IrpSubmitResult {
  irn: string;
  ackNo: string;
  ackDate: Date;
  signedQrCode: string;
}

export interface IrpAdapter {
  readonly name: string;
  submitInvoice(payload: IrpInvoicePayload): Promise<IrpSubmitResult>;
  cancelInvoice(irn: string, reason: string): Promise<{ cancelDate: Date }>;
}
