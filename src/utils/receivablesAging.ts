/**
 * Receivables aging — how long money owed to the business has been owed.
 *
 * Two decisions worth stating, because both change the number an owner sees:
 *
 * 1. **Aged from the due date, not the invoice date.** An invoice issued 45
 *    days ago on 60-day terms is not overdue, and showing it in a "31–60"
 *    bucket beside genuinely late money would be misleading. Invoices with no
 *    due date fall back to the invoice date, which is the only honest reading
 *    of "payable on issue". Not-yet-due money gets its own bucket rather than
 *    being folded into 0–30.
 *
 * 2. **Standalone payments are applied oldest-first before bucketing.** A
 *    `Payment` in BillBook is recorded against a *party*, not against an
 *    invoice (see PRODUCT_CONTEXT §4), so an invoice can still show its full
 *    `dueAmount` after the customer has paid. Aging raw invoice dues would
 *    therefore overstate receivables and would not tie back to the Dashboard's
 *    "To Collect". Allocating that credit to the oldest open invoice first is
 *    both standard practice and the assumption most favourable to the
 *    customer — it clears their oldest debt rather than inflating the
 *    scariest bucket.
 */

export const AGING_BUCKETS = [
  "notDue",
  "d0_30",
  "d31_60",
  "d61_90",
  "d90plus",
] as const;

export type AgingBucket = (typeof AGING_BUCKETS)[number];

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  notDue: "Not yet due",
  d0_30: "0–30 days",
  d31_60: "31–60 days",
  d61_90: "61–90 days",
  d90plus: "90+ days",
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v: number): number => {
  const r = Math.round(v * 100) / 100;
  return r === 0 ? 0 : r;
};

/** Whole days between two instants, floored, ignoring clock time. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((b - a) / 86_400_000);
}

/** Which bucket a given number of days past due falls into. */
export function bucketFor(daysPastDue: number): AgingBucket {
  if (daysPastDue <= 0) return "notDue";
  if (daysPastDue <= 30) return "d0_30";
  if (daysPastDue <= 60) return "d31_60";
  if (daysPastDue <= 90) return "d61_90";
  return "d90plus";
}

export interface AgeableInvoice {
  /** Remaining amount on the invoice. */
  dueAmount: unknown;
  /** Due date; falls back to `invoiceDate` when absent. */
  dueDate?: Date | string | null;
  invoiceDate?: Date | string | null;
}

export type BucketTotals = Record<AgingBucket, number>;

export const emptyBuckets = (): BucketTotals => ({
  notDue: 0,
  d0_30: 0,
  d31_60: 0,
  d61_90: 0,
  d90plus: 0,
});

/**
 * Age one party's invoices, applying `credit` to the oldest first.
 *
 * Returns the per-bucket split plus how much credit was left over — an excess
 * means the party has paid more than their open invoices, which is a payable,
 * not a receivable, and must not be shown as a negative age bucket.
 */
export function ageInvoices(
  invoices: AgeableInvoice[],
  credit: number,
  asOf: Date
): { buckets: BucketTotals; total: number; unusedCredit: number } {
  const open = invoices
    .map((inv) => {
      const effective = inv.dueDate ?? inv.invoiceDate ?? asOf;
      return { due: num(inv.dueAmount), date: new Date(effective as any) };
    })
    .filter((r) => r.due > 0 && !Number.isNaN(r.date.getTime()))
    // Oldest first, so credit clears the most overdue debt.
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let remaining = Math.max(0, num(credit));
  const buckets = emptyBuckets();
  let total = 0;

  for (const row of open) {
    const applied = Math.min(remaining, row.due);
    remaining = round2(remaining - applied);
    const outstanding = round2(row.due - applied);
    if (outstanding <= 0) continue;

    buckets[bucketFor(daysBetween(row.date, asOf))] = round2(
      buckets[bucketFor(daysBetween(row.date, asOf))] + outstanding
    );
    total = round2(total + outstanding);
  }

  return { buckets, total, unusedCredit: remaining };
}

/** Sum a list of per-party bucket splits into one set of totals. */
export function sumBuckets(all: BucketTotals[]): BucketTotals {
  const out = emptyBuckets();
  for (const b of all) {
    for (const k of AGING_BUCKETS) out[k] = round2(out[k] + num(b[k]));
  }
  return out;
}
