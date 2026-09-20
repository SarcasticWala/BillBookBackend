import { env } from "../../config/env";
import { IrpAdapter, IrpInvoicePayload, IrpSubmitResult } from "./IrpAdapter";

/**
 * Direct integration with NIC's government e-invoice API (no GSP).
 *
 * NOT YET WIRED UP — this is a placeholder that fails loudly until real
 * credentials exist. NIC's actual API (roughly, subject to their current
 * docs at the time of integration):
 *   1. POST /eivital/v1.03/auth  → session auth token (username/password +
 *      client_id/client_secret, app IP must be whitelisted with NIC).
 *   2. POST /eicore/v1.03/Invoice → the GST INV-01 payload, returns
 *      { Irn, AckNo, AckDt, SignedQRCode, SignedInvoice }.
 *   3. POST /ei/api/invoice/cancel → cancel within 24h of generation.
 * Requests/responses are typically AES-encrypted with a session key
 * exchanged via the taxpayer's RSA public key — that crypto layer isn't
 * implemented here since there's nothing real to test it against yet.
 *
 * When real credentials are available: fill in the HTTP calls below, keep
 * the same submitInvoice/cancelInvoice signatures, and flip
 * EINVOICE_PROVIDER=NIC — nothing else in the app needs to change.
 */
export const nicIrpAdapter: IrpAdapter = {
  name: "NIC",

  async submitInvoice(_payload: IrpInvoicePayload): Promise<IrpSubmitResult> {
    if (!env.eInvoice.nic.gstin || !env.eInvoice.nic.clientId) {
      throw new Error(
        "NIC e-invoice credentials are not configured (EINVOICE_NIC_*). " +
          "Set EINVOICE_PROVIDER=MOCK until they are, or configure them in .env."
      );
    }
    throw new Error("NIC IRP integration is not implemented yet — see comments in nicIrpAdapter.ts");
  },

  async cancelInvoice(_irn: string, _reason: string): Promise<{ cancelDate: Date }> {
    throw new Error("NIC IRP integration is not implemented yet — see comments in nicIrpAdapter.ts");
  },
};
