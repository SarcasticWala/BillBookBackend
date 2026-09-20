import { isValidGstin } from "./gstin";

/**
 * B2B, export, and SEZ invoices need an e-invoice; B2C never does (GST rule).
 * EXPORT/SEZ parties are always eligible regardless of GSTIN; a DOMESTIC
 * party is eligible only with a real, checksum-valid GSTIN — anything else
 * (no GSTIN, or an invalid one) is treated as B2C and skipped.
 */
export function isPartyEInvoiceEligible(party: {
  gstCategory?: string;
  gstNumber?: string;
}): boolean {
  if (party.gstCategory === "EXPORT" || party.gstCategory === "SEZ") return true;
  return isValidGstin(party.gstNumber || "");
}
