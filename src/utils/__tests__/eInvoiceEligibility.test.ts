import assert from "node:assert";
import { isPartyEInvoiceEligible } from "../eInvoiceEligibility";

// B2C: domestic party, no GSTIN — the default for every existing party.
assert.strictEqual(isPartyEInvoiceEligible({ gstCategory: "DOMESTIC", gstNumber: "" }), false);
assert.strictEqual(isPartyEInvoiceEligible({}), false);

// Domestic with an invalid/garbage GSTIN is still treated as B2C, not blocked.
assert.strictEqual(
  isPartyEInvoiceEligible({ gstCategory: "DOMESTIC", gstNumber: "not-a-gstin" }),
  false
);

// B2B: domestic party with a real, checksum-valid GSTIN.
assert.strictEqual(
  isPartyEInvoiceEligible({ gstCategory: "DOMESTIC", gstNumber: "27AAPFU0939F1ZV" }),
  true
);

// EXPORT/SEZ are always eligible, GSTIN or not.
assert.strictEqual(isPartyEInvoiceEligible({ gstCategory: "EXPORT", gstNumber: "" }), true);
assert.strictEqual(isPartyEInvoiceEligible({ gstCategory: "SEZ" }), true);

console.log("eInvoiceEligibility.test.ts: all assertions passed");
