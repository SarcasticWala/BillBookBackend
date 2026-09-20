import { Types } from "mongoose";
import { SaleInvoice } from "../models/SaleInvoice";
import { PurchaseInvoice } from "../models/PurchaseInvoice";
import { Payment } from "../models/Payment";
import { Expense } from "../models/Expense";
import { Party } from "../models/Party";
import { Item } from "../models/Item";
import { ApiError } from "../utils/ApiError";

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
 * Party Wise Outstanding: `Party.balance` is kept in sync with sale/purchase
 * invoices as they're created/edited/voided, but standalone Payment records
 * are never applied to it — so it alone under/overstates what's actually
 * outstanding once a party has any payment history. Adjust it here with the
 * net payment effect (PAYMENT_IN reduces what they owe us, PAYMENT_OUT
 * reduces what we owe them) rather than trusting the stored field as-is.
 */
export async function partyOutstanding(userId: Types.ObjectId) {
  const [parties, paymentAgg] = await Promise.all([
    Party.find({ user: userId }).select("partyName partyType mobileNo balance").lean(),
    Payment.aggregate([
      { $match: { user: userId } },
      { $group: { _id: { partyId: "$partyId", type: "$type" }, total: { $sum: "$amount" } } },
    ]),
  ]);

  const paymentByParty = new Map<string, { in: number; out: number }>();
  for (const row of paymentAgg as any[]) {
    const key = String(row._id.partyId);
    const entry = paymentByParty.get(key) || { in: 0, out: 0 };
    if (row._id.type === "PAYMENT_IN") entry.in += num(row.total);
    else entry.out += num(row.total);
    paymentByParty.set(key, entry);
  }

  return parties
    .map((p: any) => {
      const pay = paymentByParty.get(String(p._id)) || { in: 0, out: 0 };
      const outstanding = num(p.balance) - pay.in + pay.out;
      return {
        id: p._id,
        partyName: p.partyName,
        partyType: p.partyType,
        mobileNo: p.mobileNo,
        outstanding,
        status: outstanding > 0 ? "TO_COLLECT" : outstanding < 0 ? "TO_PAY" : "SETTLED",
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
