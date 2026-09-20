// Standard 15-char GSTIN structural format:
// 2-digit state code, 10-char PAN, 1-digit entity number, 'Z', 1 checksum char.
const GSTIN_SHAPE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function checksumChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < first14.length; i++) {
    const value = CHARSET.indexOf(first14[i]);
    const factor = i % 2 === 0 ? 1 : 2;
    const product = value * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36];
}

/** Validates GSTIN structure AND its checksum digit (the GSTN mod-36 algorithm). */
export function isValidGstin(gstin: string): boolean {
  const v = String(gstin || "").trim().toUpperCase();
  if (!GSTIN_SHAPE.test(v)) return false;
  return checksumChar(v.slice(0, 14)) === v[14];
}
