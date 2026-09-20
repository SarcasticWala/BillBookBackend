import assert from "node:assert";
import { isValidGstin } from "../gstin";

// Widely-used public sample GSTIN (structurally valid, correct checksum).
assert.strictEqual(isValidGstin("27AAPFU0939F1ZV"), true, "known-valid GSTIN should pass");
assert.strictEqual(isValidGstin("27aapfu0939f1zv"), true, "lowercase input should be normalized");
assert.strictEqual(isValidGstin("27AAPFU0939F1ZA"), false, "wrong checksum char should fail");
assert.strictEqual(isValidGstin("27AAPFU0939F1Z"), false, "too short should fail");
assert.strictEqual(isValidGstin(""), false, "empty string should fail");
assert.strictEqual(isValidGstin("XX AAPFU0939F1ZV"), false, "non-digit state code should fail");

console.log("gstin.test.ts: all assertions passed");
