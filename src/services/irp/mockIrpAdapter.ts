import { createHash, randomBytes } from "crypto";
import { IrpAdapter, IrpInvoicePayload, IrpSubmitResult } from "./IrpAdapter";

/**
 * Simulates a real IRP closely enough to exercise eligibility, idempotency,
 * and cancellation logic end-to-end without any real credentials. Swap for
 * nicIrpAdapter.ts once real NIC access is configured — nothing else changes.
 */
export const mockIrpAdapter: IrpAdapter = {
  name: "MOCK",

  async submitInvoice(payload: IrpInvoicePayload): Promise<IrpSubmitResult> {
    // A deterministic 64-hex-char IRN (a real IRN is a SHA-256 hash of
    // sellerGstin+docType+docNo+FY) — same invoice content, same IRN.
    const irn = createHash("sha256")
      .update(`${payload.sellerGstin}|INV|${payload.invoiceNumber}|${payload.invoiceDate.getFullYear()}`)
      .digest("hex");

    // Deliberate test hook: an invoice number containing this marker
    // simulates an IRP-side failure, so retry logic can be exercised without
    // depending on real network flakiness.
    if (payload.invoiceNumber.includes("__SIMULATE_FAIL__")) {
      throw new Error("Mock IRP: simulated submission failure");
    }

    return {
      irn,
      ackNo: randomBytes(6).toString("hex"),
      ackDate: new Date(),
      signedQrCode: Buffer.from(
        JSON.stringify({ irn, no: payload.invoiceNumber, amt: payload.grandTotal })
      ).toString("base64"),
    };
  },

  async cancelInvoice(_irn: string, _reason: string): Promise<{ cancelDate: Date }> {
    return { cancelDate: new Date() };
  },
};
