import assert from "node:assert";
import { computeTaxSplit } from "../gstTaxSplit";

// Intra-state (same state code): splits evenly into CGST + SGST, no IGST.
{
  const r = computeTaxSplit(1000, 18, "27", "27");
  assert.strictEqual(r.isInterState, false);
  assert.strictEqual(r.igst, 0);
  assert.strictEqual(r.cgst, 90);
  assert.strictEqual(r.sgst, 90);
  assert.strictEqual(r.cgst + r.sgst, 180);
}

// Inter-state (different state codes): full amount as IGST, no CGST/SGST.
{
  const r = computeTaxSplit(1000, 18, "27", "07");
  assert.strictEqual(r.isInterState, true);
  assert.strictEqual(r.cgst, 0);
  assert.strictEqual(r.sgst, 0);
  assert.strictEqual(r.igst, 180);
}

// Odd-paisa rounding: cgst + sgst must still equal the total tax exactly.
{
  const r = computeTaxSplit(333.33, 18, "27", "27");
  const total = Math.round((333.33 * 18) / 100 * 100) / 100;
  assert.strictEqual(Math.round((r.cgst + r.sgst) * 100) / 100, total);
}

console.log("gstTaxSplit.test.ts: all assertions passed");
