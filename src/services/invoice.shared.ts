import { Types } from "mongoose";
import { Item } from "../models/Item";

export interface InvoiceItemRow {
  itemId?: string;
  quantity?: number;
  [k: string]: any;
}

/**
 * Adjust product stock for each invoice line that references an item.
 * direction = -1 for sales (stock out), +1 for purchases (stock in).
 * Runs as bulk ops to avoid an N+1 loop of round-trips.
 */
export async function applyStockDelta(
  userId: Types.ObjectId,
  rows: InvoiceItemRow[],
  direction: 1 | -1
): Promise<void> {
  const ops = rows
    .filter((r) => r.itemId)
    .map((r) => ({
      updateOne: {
        filter: { _id: r.itemId, user: userId },
        update: { $inc: { stock: direction * (Number(r.quantity) || 0) } },
      },
    }));
  if (ops.length) await Item.bulkWrite(ops);
}

export function computeStatus(dueAmount: number, receivedAmount: number): string {
  if (dueAmount <= 0) return "PAID";
  if (receivedAmount > 0) return "PARTIAL";
  return "UNPAID";
}

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Server-authoritative invoice money. The client computes these too (for
 * display), but we never trust them: we re-derive the grand total from the
 * line items (sum of each row's own total) plus additional charges minus the
 * after-tax discount, clamp everything non-negative (a "discount" can't be a
 * surcharge, amounts can't be negative), and compute the balance from what was
 * actually paid. For an honest client this yields exactly the same numbers.
 */
export function computeInvoiceTotals(
  rows: InvoiceItemRow[],
  body: Record<string, any>,
  paidRaw: unknown
): {
  grand: number;
  additionalCharges: number;
  discountAfterTax: number;
  paid: number;
  dueAmount: number;
} {
  const lineSum = rows.reduce((a, r) => a + toNum((r as any).totalAmount), 0);
  const additionalCharges = Math.max(0, toNum(body.additionalCharges));
  const discountAfterTax = Math.max(0, toNum(body.discountAfterTax));
  const grand = Math.max(0, round2(lineSum + additionalCharges - discountAfterTax));
  const paid = Math.max(0, toNum(paidRaw));
  const dueAmount = Math.max(0, round2(grand - paid));
  return { grand, additionalCharges, discountAfterTax, paid, dueAmount };
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
