import * as XLSX from "xlsx";

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Parse the first sheet of an uploaded .xlsx buffer into an array of row objects. */
export function parseSheet<T = Record<string, any>>(buffer: Buffer): T[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<T>(sheet, { defval: "" });
}

/**
 * Build an .xlsx buffer of rows that failed validation, each annotated with an
 * "Error" column. The frontend's custom base query reads this ArrayBuffer when
 * the response is status 400 with the spreadsheet content-type.
 */
export function buildErrorWorkbook(
  rowsWithErrors: Array<Record<string, any> & { Error: string }>
): Buffer {
  const ws = XLSX.utils.json_to_sheet(rowsWithErrors);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Errors");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
