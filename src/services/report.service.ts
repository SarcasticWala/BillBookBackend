import { Types } from "mongoose";
import { SaleInvoice } from "../models/SaleInvoice";
import { PurchaseInvoice } from "../models/PurchaseInvoice";
import { Payment } from "../models/Payment";
import { Expense } from "../models/Expense";
import { Party } from "../models/Party";
import { Item } from "../models/Item";
import { ApiError } from "../utils/ApiError";
import {
  computePartyBalance,
  signedOpeningBalance,
  splitReceivablePayable,
} from "../utils/partyBalance";
import {
  ageInvoices,
  sumBuckets,
  AGING_BUCKETS,
  AGING_BUCKET_LABELS,
  type AgeableInvoice,
} from "../utils/receivablesAging";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Inclusive day range from optional `from`/`to` query strings (YYYY-MM-DD). */
function parseRange(from?: unknown, to?: unknown, defaultDays = 30) {
  const end = to ? new Date(String(to)) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = from
    ? new Date(String(from))
    : new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  start.setHours(0, 0, 0, 0);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ApiError(400, "Invalid date range");
  }
  return { start, end };
}

// SaleInvoice and PurchaseInvoice look identical at a glance (same schema
// file shape) but the fields each service actually writes on create/update
// differ: sale.service writes totalSaleAmount/receivedAmount, while
// purchase.service writes totalPurchaseAmount/paidAmount — the "shared"
// names on the schema (totalSaleAmount, receivedAmount) are just unused
// defaults on a PurchaseInvoice document, always 0. Verified directly
// against real created documents, not just the schema file.
const invoiceTotalsPipeline = (
  userId: Types.ObjectId,
  start: Date,
  end: Date,
  totalField: string,
  paidField: string
) => [
  { $match: { user: userId, status: { $ne: "VOID" }, invioceDate: { $gte: start, $lte: end } } },
  {
    $group: {
      _id: null,
      count: { $sum: 1 },
      taxableAmount: { $sum: "$totalTaxableSaleAmount" },
      tax: { $sum: "$totalTax" },
      totalAmount: { $sum: `$${totalField}` },
      receivedAmount: { $sum: `$${paidField}` },
      dueAmount: { $sum: "$dueAmount" },
    },
  },
];

/** Sales Summary: totals + the invoice list for the range. */
export async function salesSummary(userId: Types.ObjectId, from?: unknown, to?: unknown) {
  const { start, end } = parseRange(from, to);
  const [totalsAgg, invoices] = await Promise.all([
    SaleInvoice.aggregate(
      invoiceTotalsPipeline(userId, start, end, "totalSaleAmount", "receivedAmount")
    ),
    SaleInvoice.find({ user: userId, status: { $ne: "VOID" }, invioceDate: { $gte: start, $lte: end } })
      .sort({ invioceDate: -1 })
      .limit(1000)
      .select("invioceNo invioceDate partyName totalSaleAmount totalTax dueAmount status")
      .lean(),
  ]);
  const t = totalsAgg[0] || {};
  return {
    range: { start, end },
    totals: {
      count: num(t.count),
      taxableAmount: num(t.taxableAmount),
      tax: num(t.tax),
      totalAmount: num(t.totalAmount),
      receivedAmount: num(t.receivedAmount),
      dueAmount: num(t.dueAmount),
    },
    invoices: invoices.map((i: any) => ({
      id: i._id,
      invioceNo: i.invioceNo,
      invioceDate: i.invioceDate,
      partyName: i.partyName,
      totalAmount: num(i.totalSaleAmount),
      tax: num(i.totalTax),
      dueAmount: num(i.dueAmount),
      status: i.status,
    })),
  };
}

/** Purchase Summary: same shape as Sales Summary, over PurchaseInvoice. */
export async function purchaseSummary(userId: Types.ObjectId, from?: unknown, to?: unknown) {
  const { start, end } = parseRange(from, to);
  const [totalsAgg, invoices] = await Promise.all([
    PurchaseInvoice.aggregate(
      invoiceTotalsPipeline(userId, start, end, "totalPurchaseAmount", "paidAmount")
    ),
    PurchaseInvoice.find({ user: userId, status: { $ne: "VOID" }, invioceDate: { $gte: start, $lte: end } })
      .sort({ invioceDate: -1 })
      .limit(1000)
      .select("invioceNo invioceDate partyName totalPurchaseAmount totalTax dueAmount status")
      .lean(),
  ]);
  const t = totalsAgg[0] || {};
  return {
    range: { start, end },
    totals: {
      count: num(t.count),
      taxableAmount: num(t.taxableAmount),
      tax: num(t.tax),
      totalAmount: num(t.totalAmount),
      receivedAmount: num(t.receivedAmount),
      dueAmount: num(t.dueAmount),
    },
    invoices: invoices.map((i: any) => ({
      id: i._id,
      invioceNo: i.invioceNo,
      invioceDate: i.invioceDate,
      partyName: i.partyName,
      totalAmount: num(i.totalPurchaseAmount),
      tax: num(i.totalTax),
      dueAmount: num(i.dueAmount),
      status: i.status,
    })),
  };
}

/**
 * Daybook: every sale, purchase, payment and expense in the range, merged
 * into one chronological feed.
 */
export async function daybook(userId: Types.ObjectId, from?: unknown, to?: unknown) {
  const { start, end } = parseRange(from, to);
  const dateMatch = { $gte: start, $lte: end };

  const [sales, purchases, payments, expenses] = await Promise.all([
    SaleInvoice.find({ user: userId, status: { $ne: "VOID" }, invioceDate: dateMatch })
      .select("invioceNo invioceDate partyName totalSaleAmount")
      .lean(),
    PurchaseInvoice.find({ user: userId, status: { $ne: "VOID" }, invioceDate: dateMatch })
      .select("invioceNo invioceDate partyName totalPurchaseAmount")
      .lean(),
    Payment.find({ user: userId, paymentDate: dateMatch })
      .select("paymentNo paymentDate partyName amount type mode")
      .lean(),
    Expense.find({ user: userId, expenseDate: dateMatch })
      .select("expenseNumber expenseDate partyName amount category")
      .lean(),
  ]);

  const entries = [
    ...sales.map((s: any) => ({
      date: s.invioceDate,
      type: "Sale" as const,
      refNo: s.invioceNo,
      party: s.partyName || "-",
      amount: num(s.totalSaleAmount),
      direction: "IN" as const,
    })),
    ...purchases.map((p: any) => ({
      date: p.invioceDate,
      type: "Purchase" as const,
      refNo: p.invioceNo,
      party: p.partyName || "-",
      amount: num(p.totalPurchaseAmount),
      direction: "OUT" as const,
    })),
    ...payments.map((pm: any) => ({
      date: pm.paymentDate,
      type: (pm.type === "PAYMENT_IN" ? "Payment In" : "Payment Out") as
        | "Payment In"
        | "Payment Out",
      refNo: pm.paymentNo,
      party: pm.partyName || "-",
      amount: num(pm.amount),
      direction: (pm.type === "PAYMENT_IN" ? "IN" : "OUT") as "IN" | "OUT",
    })),
    ...expenses.map((e: any) => ({
      date: e.expenseDate,
      type: "Expense" as const,
      refNo: e.expenseNumber,
      party: e.partyName || e.category || "-",
      amount: num(e.amount),
      direction: "OUT" as const,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalIn = entries.filter((e) => e.direction === "IN").reduce((s, e) => s + e.amount, 0);
  const totalOut = entries.filter((e) => e.direction === "OUT").reduce((s, e) => s + e.amount, 0);

  return { range: { start, end }, totals: { totalIn, totalOut, net: totalIn - totalOut }, entries };
}

/**
 * Party Wise Outstanding — derived from source records, never from the stored
 * `Party.balance`.
 *
 * This used to read the stored field and add back the net payment effect,
 * because payments didn't update it. They do now (`payment.service`), so that
 * compensation would double-count every payment. Rather than swap one
 * assumption about the cache for another, this rebuilds the figure from the
 * invoices and payments themselves via `computePartyBalance` — the same
 * function the reconciliation script and the ledger agree with.
 *
 * The practical benefit: this report is correct whether or not the one-time
 * balance backfill has been run, so report accuracy doesn't depend on
 * deployment ordering.
 */
export async function partyOutstanding(userId: Types.ObjectId) {
  const [parties, saleAgg, purchaseAgg, paymentAgg] = await Promise.all([
    Party.find({ user: userId })
      .select("partyName partyType mobileNo openingBalance openingBalanceType")
      .lean(),
    SaleInvoice.aggregate([
      { $match: { user: userId, status: { $ne: "VOID" } } },
      { $group: { _id: "$partyId", total: { $sum: "$dueAmount" } } },
    ]),
    PurchaseInvoice.aggregate([
      { $match: { user: userId, status: { $ne: "VOID" } } },
      { $group: { _id: "$partyId", total: { $sum: "$dueAmount" } } },
    ]),
    Payment.aggregate([
      { $match: { user: userId } },
      { $group: { _id: { partyId: "$partyId", type: "$type" }, total: { $sum: "$amount" } } },
    ]),
  ]);

  const byParty = new Map<
    string,
    { saleDue: number; purchaseDue: number; paymentIn: number; paymentOut: number }
  >();
  const bucket = (id: unknown) => {
    const key = String(id);
    let e = byParty.get(key);
    if (!e) {
      e = { saleDue: 0, purchaseDue: 0, paymentIn: 0, paymentOut: 0 };
      byParty.set(key, e);
    }
    return e;
  };

  for (const row of saleAgg as any[]) bucket(row._id).saleDue += num(row.total);
  for (const row of purchaseAgg as any[]) bucket(row._id).purchaseDue += num(row.total);
  for (const row of paymentAgg as any[]) {
    const e = bucket(row._id.partyId);
    if (row._id.type === "PAYMENT_IN") e.paymentIn += num(row.total);
    else e.paymentOut += num(row.total);
  }

  return parties
    .map((p: any) => {
      const src = byParty.get(String(p._id));
      const outstanding = computePartyBalance({
        openingBalance: p.openingBalance,
        openingBalanceType: p.openingBalanceType,
        ...src,
      });
      return {
        id: p._id,
        partyName: p.partyName,
        partyType: p.partyType,
        mobileNo: p.mobileNo,
        outstanding,
        ...splitReceivablePayable(outstanding),
      };
    })
    .sort((a, b) => Math.abs(b.outstanding) - Math.abs(a.outstanding));
}

/**
 * Party Statement (Ledger): every sale/purchase/payment for one party,
 * chronological, with a running balance. Uses the same delta convention as
 * `partyOutstanding` (sale.dueAmount / -purchase.dueAmount / payment in-out)
 * so the closing balance always reconciles with that report.
 */
export async function partyLedger(
  userId: Types.ObjectId,
  partyId: string,
  from?: unknown,
  to?: unknown
) {
  const party = await Party.findOne({ _id: partyId, user: userId }).lean();
  if (!party) throw new ApiError(404, "Party not found");

  const { start, end } = parseRange(from, to, 90);

  const [sales, purchases, payments] = await Promise.all([
    SaleInvoice.find({ user: userId, partyId, status: { $ne: "VOID" } })
      .select("invioceNo invioceDate dueAmount")
      .sort({ invioceDate: 1 })
      .lean(),
    PurchaseInvoice.find({ user: userId, partyId, status: { $ne: "VOID" } })
      .select("invioceNo invioceDate dueAmount")
      .sort({ invioceDate: 1 })
      .lean(),
    Payment.find({ user: userId, partyId })
      .select("paymentNo paymentDate amount type")
      .sort({ paymentDate: 1 })
      .lean(),
  ]);

  const signedOpening =
    (party as any).openingBalanceType === "TO_PAY"
      ? -num((party as any).openingBalance)
      : num((party as any).openingBalance);

  const all = [
    ...sales.map((s: any) => ({
      date: s.invioceDate,
      type: "Sale" as const,
      refNo: s.invioceNo,
      delta: num(s.dueAmount),
    })),
    ...purchases.map((p: any) => ({
      date: p.invioceDate,
      type: "Purchase" as const,
      refNo: p.invioceNo,
      delta: -num(p.dueAmount),
    })),
    ...payments.map((pm: any) => ({
      date: pm.paymentDate,
      type: (pm.type === "PAYMENT_IN" ? "Payment In" : "Payment Out") as
        | "Payment In"
        | "Payment Out",
      refNo: pm.paymentNo,
      delta: pm.type === "PAYMENT_IN" ? -num(pm.amount) : num(pm.amount),
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = signedOpening;
  let openingAsOfRangeStart = signedOpening;
  const entries: Array<{ date: Date; type: string; refNo: string; delta: number; balance: number }> = [];

  for (const entry of all) {
    const d = new Date(entry.date);
    if (d < start) {
      openingAsOfRangeStart += entry.delta;
      running = openingAsOfRangeStart;
      continue;
    }
    if (d > end) continue;
    running += entry.delta;
    entries.push({ ...entry, balance: running });
  }

  return {
    party: { id: party._id, partyName: (party as any).partyName, partyType: (party as any).partyType },
    range: { start, end },
    openingBalance: openingAsOfRangeStart,
    closingBalance: running,
    entries,
  };
}

/** Stock Summary: current stock + valuation per product item. */
export async function stockSummary(userId: Types.ObjectId, lowStockOnly?: unknown) {
  const items = await Item.find({ user: userId, itemType: "PRODUCT" })
    .select("name categoryName unit stock openingStock purchasePrice salePrice productAlertValue isAlertEnabled")
    .sort({ name: 1 })
    .lean();

  const rows = items.map((i: any) => {
    const stock = num(i.stock);
    const isLow = Boolean(i.isAlertEnabled) && stock <= num(i.productAlertValue);
    return {
      id: i._id,
      name: i.name,
      categoryName: i.categoryName || "-",
      unit: i.unit || "PCS",
      stock,
      openingStock: num(i.openingStock),
      stockValue: stock * num(i.purchasePrice),
      saleValue: stock * num(i.salePrice),
      isLow,
    };
  });

  const filtered = lowStockOnly === "true" ? rows.filter((r) => r.isLow) : rows;

  return {
    totals: {
      items: filtered.length,
      stockValue: filtered.reduce((s, r) => s + r.stockValue, 0),
      lowStockCount: rows.filter((r) => r.isLow).length,
    },
    items: filtered,
  };
}

/**
 * Receivables Aging: what customers owe, split by how overdue it is.
 *
 * Extends the Dashboard's "To Collect" from a single number into the question
 * an owner actually needs answered — *how old* is that money. The aging rules
 * (aged from due date, not-yet-due kept separate, standalone payments applied
 * oldest-first) live in `utils/receivablesAging.ts` and are unit-covered.
 *
 * Scope, stated so the figure can be trusted:
 *  - Sale invoices only. Purchases are money we owe, not money owed to us.
 *  - VOID invoices excluded, matching every other report.
 *  - Opening balances carry no date, so they cannot be aged. They are reported
 *    separately in `reconciliation` rather than guessed into a bucket — that
 *    is the difference between this report's total and a party's full
 *    outstanding.
 */
export async function receivablesAging(userId: Types.ObjectId, asOfInput?: unknown) {
  const asOf = asOfInput ? new Date(String(asOfInput)) : new Date();
  if (Number.isNaN(asOf.getTime())) throw new ApiError(400, "Invalid asOf date");

  const [parties, invoices, paymentAgg] = await Promise.all([
    Party.find({ user: userId })
      .select("partyName partyType mobileNo openingBalance openingBalanceType")
      .lean(),
    SaleInvoice.find({ user: userId, status: { $ne: "VOID" }, dueAmount: { $gt: 0 } })
      .select("partyId dueAmount dueDate invioceDate")
      .lean(),
    Payment.aggregate([
      { $match: { user: userId } },
      { $group: { _id: { partyId: "$partyId", type: "$type" }, total: { $sum: "$amount" } } },
    ]),
  ]);

  const invoicesByParty = new Map<string, AgeableInvoice[]>();
  for (const inv of invoices as any[]) {
    const key = String(inv.partyId);
    const list = invoicesByParty.get(key) || [];
    list.push({
      dueAmount: inv.dueAmount,
      dueDate: inv.dueDate,
      invoiceDate: inv.invioceDate,
    });
    invoicesByParty.set(key, list);
  }

  // Net standalone payment credit available to offset open invoices. Payments
  // out reduce that credit because they are money moving the other way.
  const creditByParty = new Map<string, number>();
  for (const row of paymentAgg as any[]) {
    const key = String(row._id.partyId);
    const signed = row._id.type === "PAYMENT_IN" ? num(row.total) : -num(row.total);
    creditByParty.set(key, (creditByParty.get(key) || 0) + signed);
  }

  const rows = [];
  let openingNotAged = 0;
  let unappliedCredit = 0;

  for (const p of parties as any[]) {
    const key = String(p._id);
    const list = invoicesByParty.get(key) || [];
    const opening = signedOpeningBalance(p.openingBalance, p.openingBalanceType);
    if (opening > 0) openingNotAged += opening;
    if (!list.length) continue;

    const { buckets, total, unusedCredit } = ageInvoices(
      list,
      creditByParty.get(key) || 0,
      asOf
    );
    unappliedCredit += unusedCredit;
    if (total <= 0) continue;

    rows.push({
      partyId: p._id,
      partyName: p.partyName,
      partyType: p.partyType,
      mobileNo: p.mobileNo,
      ...buckets,
      total,
    });
  }

  rows.sort((a, b) => b.total - a.total);
  const buckets = sumBuckets(rows.map((r) => ({
    notDue: r.notDue,
    d0_30: r.d0_30,
    d31_60: r.d31_60,
    d61_90: r.d61_90,
    d90plus: r.d90plus,
  })));
  const outstanding = rows.reduce((s, r) => s + r.total, 0);

  return {
    asOf,
    buckets: AGING_BUCKETS.map((key) => ({
      key,
      label: AGING_BUCKET_LABELS[key],
      amount: buckets[key],
    })),
    totals: {
      outstanding: Math.round(outstanding * 100) / 100,
      overdue: Math.round((outstanding - buckets.notDue) * 100) / 100,
      notDue: buckets.notDue,
      parties: rows.length,
    },
    reconciliation: {
      openingBalancesNotAged: Math.round(openingNotAged * 100) / 100,
      unappliedCredit: Math.round(unappliedCredit * 100) / 100,
    },
    rows,
  };
}
