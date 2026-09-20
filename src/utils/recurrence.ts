export type BillFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
export const BILL_FREQUENCIES: BillFrequency[] = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
];

const pad = (n: number): string => String(n).padStart(2, "0");

/** ISO-8601 week number and week-year for a date. */
function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

/**
 * Deterministic "which billing period does this date fall into" key — the
 * building block of exactly-once generation. AutomatedBillRun enforces a
 * unique (template, period) index, so no matter how many times the
 * scheduler ticks or retries within the same period, only one run for it
 * can ever exist.
 */
export function computePeriodKey(frequency: BillFrequency, date: Date): string {
  switch (frequency) {
    case "DAILY":
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    case "WEEKLY": {
      const { year, week } = isoWeek(date);
      return `${year}-W${pad(week)}`;
    }
    case "MONTHLY":
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    case "QUARTERLY":
      return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
    case "YEARLY":
      return `${date.getFullYear()}`;
  }
}

/** The next occurrence date, exactly one interval after `date`. */
export function addInterval(date: Date, frequency: BillFrequency): Date {
  const d = new Date(date);
  switch (frequency) {
    case "DAILY":
      d.setDate(d.getDate() + 1);
      break;
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}
