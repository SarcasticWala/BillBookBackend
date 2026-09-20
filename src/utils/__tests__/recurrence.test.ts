import assert from "node:assert";
import { computePeriodKey, addInterval } from "../recurrence";

// Period keys — same date must always yield the same key (idempotency
// depends on this being deterministic), and different frequencies must
// bucket differently.
assert.strictEqual(computePeriodKey("DAILY", new Date(2026, 8, 20)), "2026-09-20");
assert.strictEqual(computePeriodKey("MONTHLY", new Date(2026, 8, 20)), "2026-09");
assert.strictEqual(computePeriodKey("MONTHLY", new Date(2026, 8, 1)), "2026-09");
assert.strictEqual(computePeriodKey("QUARTERLY", new Date(2026, 8, 20)), "2026-Q3");
assert.strictEqual(computePeriodKey("QUARTERLY", new Date(2026, 0, 1)), "2026-Q1");
assert.strictEqual(computePeriodKey("YEARLY", new Date(2026, 8, 20)), "2026");
// A known ISO week: 2026-09-20 is a Sunday in ISO week 38 of 2026.
assert.strictEqual(computePeriodKey("WEEKLY", new Date(2026, 8, 20)), "2026-W38");

// Two dates in the same month/week/etc must collide on the same period key —
// this IS the exactly-once guarantee (both would hit the same unique index row).
assert.strictEqual(
  computePeriodKey("MONTHLY", new Date(2026, 8, 1)),
  computePeriodKey("MONTHLY", new Date(2026, 8, 30))
);

// addInterval — each frequency advances by exactly one unit, and repeated
// application lands on the expected calendar date (including month-length
// and leap-year edge cases).
assert.strictEqual(addInterval(new Date(2026, 0, 31), "MONTHLY").getMonth(), 2); // Jan 31 -> Mar 3 (JS Date rollover), not Feb 31
assert.strictEqual(addInterval(new Date(2026, 8, 20), "DAILY").getDate(), 21);
assert.strictEqual(addInterval(new Date(2026, 8, 20), "WEEKLY").getDate(), 27);
assert.strictEqual(addInterval(new Date(2026, 8, 20), "QUARTERLY").getMonth(), 11);
assert.strictEqual(addInterval(new Date(2024, 1, 29), "YEARLY").getFullYear(), 2025); // leap day survives via rollover

console.log("recurrence.test.ts: all assertions passed");
