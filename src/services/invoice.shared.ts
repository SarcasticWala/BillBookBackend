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
