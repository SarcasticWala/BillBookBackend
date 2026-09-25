import assert from "node:assert";
import {
  ageInvoices,
  bucketFor,
  daysBetween,
  sumBuckets,
  emptyBuckets,
} from "../receivablesAging";

// Local-date fixtures on purpose: `daysBetween` counts local calendar days
// (an owner reads "45 days overdue" in their own timezone, not UTC), so mixing
// UTC literals in here would make the test pass or fail depending on the
// machine running it.
const asOf = new Date(2026, 8, 26);
const daysAgo = (n: number) => new Date(2026, 8, 26 - n);

// Bucket boundaries — the off-by-one here decides whether a 30-day-old debt
// reads as "0–30" or "31–60" on an owner's screen.
{
  assert.strictEqual(bucketFor(-5), "notDue");
  assert.strictEqual(bucketFor(0), "notDue", "due today is not yet overdue");
  assert.strictEqual(bucketFor(1), "d0_30");
  assert.strictEqual(bucketFor(30), "d0_30");
  assert.strictEqual(bucketFor(31), "d31_60");
  assert.strictEqual(bucketFor(60), "d31_60");
  assert.strictEqual(bucketFor(61), "d61_90");
  assert.strictEqual(bucketFor(90), "d61_90");
  assert.strictEqual(bucketFor(91), "d90plus");
}

// Day counting ignores clock time, so an invoice doesn't change bucket
// depending on what time of day the report is opened.
{
  assert.strictEqual(
    daysBetween(new Date(2026, 8, 1, 23, 59), new Date(2026, 8, 2, 0, 1)),
    1,
    "two minutes apart but different calendar days = 1 day"
  );
  assert.strictEqual(
    daysBetween(new Date(2026, 8, 1, 0, 1), new Date(2026, 8, 1, 23, 59)),
    0,
    "same calendar day regardless of clock time"
  );
  assert.strictEqual(daysBetween(asOf, asOf), 0);
}

// Straightforward spread across buckets.
{
  const { buckets, total } = ageInvoices(
    [
      { dueAmount: 1000, dueDate: daysAgo(10) },
      { dueAmount: 2000, dueDate: daysAgo(45) },
      { dueAmount: 3000, dueDate: daysAgo(75) },
      { dueAmount: 4000, dueDate: daysAgo(120) },
    ],
    0,
    asOf
  );
  assert.strictEqual(buckets.d0_30, 1000);
  assert.strictEqual(buckets.d31_60, 2000);
  assert.strictEqual(buckets.d61_90, 3000);
  assert.strictEqual(buckets.d90plus, 4000);
  assert.strictEqual(total, 10000);
}

// Not-yet-due money gets its own bucket instead of looking overdue.
{
  const { buckets, total } = ageInvoices(
    [{ dueAmount: 5000, dueDate: new Date(2026, 9, 20) }],
    0,
    asOf
  );
  assert.strictEqual(buckets.notDue, 5000);
  assert.strictEqual(buckets.d0_30, 0);
  assert.strictEqual(total, 5000);
}

// No due date falls back to the invoice date.
{
  const { buckets } = ageInvoices(
    [{ dueAmount: 800, dueDate: null, invoiceDate: daysAgo(40) }],
    0,
    asOf
  );
  assert.strictEqual(buckets.d31_60, 800);
}

// THE ONE THAT MAKES THIS REPORT TRUSTWORTHY: a standalone Payment is recorded
// against the party, not the invoice, so invoice.dueAmount stays untouched.
// Without oldest-first allocation this party would show 10,000 outstanding
// after paying 6,000, and the report would not tie back to "To Collect".
{
  const { buckets, total, unusedCredit } = ageInvoices(
    [
      { dueAmount: 4000, dueDate: daysAgo(120) }, // oldest — cleared first
      { dueAmount: 6000, dueDate: daysAgo(10) },
    ],
    6000,
    asOf
  );
  assert.strictEqual(total, 4000, "10,000 owed less 6,000 paid");
  assert.strictEqual(buckets.d90plus, 0, "oldest debt cleared by the payment");
  assert.strictEqual(buckets.d0_30, 4000, "remainder sits in the newest bucket");
  assert.strictEqual(unusedCredit, 0);
}

// Overpayment must not produce a negative bucket — that is a payable, and it
// is reported as leftover credit instead.
{
  const { buckets, total, unusedCredit } = ageInvoices(
    [{ dueAmount: 1000, dueDate: daysAgo(50) }],
    2500,
    asOf
  );
  assert.strictEqual(total, 0);
  assert.strictEqual(buckets.d31_60, 0);
  assert.strictEqual(unusedCredit, 1500);
  for (const v of Object.values(buckets)) assert.ok(v >= 0, "no negative bucket");
}

// Fully-settled and zero-value invoices are ignored entirely.
{
  const { total } = ageInvoices(
    [{ dueAmount: 0, dueDate: daysAgo(200) }, { dueAmount: -5, dueDate: daysAgo(10) }],
    0,
    asOf
  );
  assert.strictEqual(total, 0);
}

// Bucket totals across parties add up, without floating-point dust.
{
  const a = ageInvoices([{ dueAmount: 0.1, dueDate: daysAgo(5) }], 0, asOf);
  const b = ageInvoices([{ dueAmount: 0.2, dueDate: daysAgo(5) }], 0, asOf);
  assert.strictEqual(sumBuckets([a.buckets, b.buckets]).d0_30, 0.3);
  assert.strictEqual(sumBuckets([]).d0_30, emptyBuckets().d0_30);
}

// Garbage amounts must not poison the totals with NaN.
{
  const { total } = ageInvoices(
    [{ dueAmount: "abc", dueDate: daysAgo(10) }, { dueAmount: null, dueDate: daysAgo(10) }],
    0,
    asOf
  );
  assert.strictEqual(total, 0);
  assert.ok(!Number.isNaN(total));
}

console.log("receivablesAging.test.ts: all assertions passed");
