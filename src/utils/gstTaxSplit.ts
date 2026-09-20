import { round2 } from "../services/invoice.shared";

export interface TaxSplit {
  cgst: number;
  sgst: number;
  igst: number;
  isInterState: boolean;
}

/**
 * Splits a flat GST amount into CGST/SGST (same state as place of supply) or
 * IGST (different state) — the breakup e-invoicing (GST INV-01) requires.
 * Existing flat-GST invoices are unaffected: nothing calls this until a
 * feature (e-invoicing) explicitly needs the breakup.
 */
export function computeTaxSplit(
  taxableAmount: number,
  gstRatePercent: number,
  sellerStateCode: string,
  placeOfSupplyStateCode: string
): TaxSplit {
  const totalTax = round2((taxableAmount * gstRatePercent) / 100);
  const isInterState = sellerStateCode !== placeOfSupplyStateCode;

  if (isInterState) {
    return { cgst: 0, sgst: 0, igst: totalTax, isInterState };
  }

  const cgst = round2(totalTax / 2);
  // sgst absorbs the rounding remainder so cgst + sgst always equals totalTax.
  const sgst = round2(totalTax - cgst);
  return { cgst, sgst, igst: 0, isInterState };
}
