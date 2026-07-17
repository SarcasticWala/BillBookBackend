import { Types } from "mongoose";
import { Party } from "../models/Party";
import { Account } from "../models/Account";
import { SaleInvoice } from "../models/SaleInvoice";
import { PurchaseInvoice } from "../models/PurchaseInvoice";
import { Payment } from "../models/Payment";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Server-side dashboard summary — aggregated across ALL of the user's records
 * (not a capped page), with voided invoices excluded so totals stay accurate.
 */
export async function getSummary(userId: Types.ObjectId) {
  const [partyAgg, acctAgg, recentSales, recentPurchases, recentPayments] =
    await Promise.all([
      // Net receivable / payable from every party's running balance.
      Party.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: null,
            toCollect: {
              $sum: { $cond: [{ $gt: ["$balance", 0] }, "$balance", 0] },
            },
            toPay: {
              $sum: { $cond: [{ $lt: ["$balance", 0] }, { $abs: "$balance" }, 0] },
            },
          },
        },
      ]),
      // Actual money on hand = sum of all cash + bank account balances.
      Account.aggregate([
        { $match: { user: userId } },
        { $group: { _id: null, cashBank: { $sum: "$balance" } } },
      ]),
      SaleInvoice.find({ user: userId, status: { $ne: "VOID" } })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      PurchaseInvoice.find({ user: userId, status: { $ne: "VOID" } })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Payment.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

  const p = partyAgg[0] || {};

  const recent = [
    ...recentSales.map((s: any) => ({
      date: s.createdAt,
      type: "Sale",
      no: s.invioceNo || "-",
      party: s.partyName || "-",
      amount: num(s.totalSaleAmount),
      sign: 1 as const,
    })),
    ...recentPurchases.map((s: any) => ({
      date: s.createdAt,
      type: "Purchase",
      no: s.invioceNo || "-",
      party: s.partyName || "-",
      amount: num(s.totalPurchaseAmount),
      sign: -1 as const,
    })),
    ...recentPayments.map((pm: any) => ({
      date: pm.paymentDate || pm.createdAt,
      type: pm.type === "PAYMENT_IN" ? "Payment In" : "Payment Out",
      no: pm.paymentNo || "-",
      party: pm.partyName || "-",
      amount: num(pm.amount),
      sign: (pm.type === "PAYMENT_IN" ? 1 : -1) as 1 | -1,
    })),
  ]
    .filter((t) => t.date)
    .sort(
      (a, b) => new Date(b.date as any).getTime() - new Date(a.date as any).getTime()
    )
    .slice(0, 8);

  return {
    toCollect: num(p.toCollect),
    toPay: num(p.toPay),
    cashBank: num(acctAgg[0]?.cashBank),
    recent,
  };
}
