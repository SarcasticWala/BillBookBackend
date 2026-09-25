/**
 * Party balance reconciliation — dry run by default.
 *
 * Why this exists
 * ---------------
 * `Party.balance` is a cache. Sale and purchase invoices maintained it, but
 * standalone `Payment` records did not (BRD BR-09 / PRD PAY-03), so every
 * party with payment history drifted. `payment.service` now keeps it in step
 * going forward; this script repairs the balances that drifted *before* that
 * fix, by rebuilding each one from source records via `computePartyBalance`.
 *
 * Safety
 * ------
 * This rewrites financial data, so it will not write anything unless you pass
 * `--apply`. Run it, read the report, and only then apply. It is idempotent:
 * the target value is derived from source records, not from the current
 * balance, so running it twice changes nothing the second time.
 *
 *   npm run reconcile:balances              # dry run — reports, writes nothing
 *   npm run reconcile:balances -- --apply   # writes, after you've read the report
 *   npm run reconcile:balances -- --user=<id>   # scope to one business
 *
 * It refuses to touch the production cluster unless `--i-understand-prod` is
 * also passed, so a stray shell can't rewrite live ledgers.
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { connectDB } from "../config/db";
import { isProd } from "../config/env";
import { Party } from "../models/Party";
import { Payment } from "../models/Payment";
import { SaleInvoice } from "../models/SaleInvoice";
import { PurchaseInvoice } from "../models/PurchaseInvoice";
import { computePartyBalance, toPaise } from "../utils/partyBalance";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const PROD_OK = args.includes("--i-understand-prod");
const userArg = args.find((a) => a.startsWith("--user="))?.split("=")[1];

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const inr = (n: number) =>
  `${n < 0 ? "-" : ""}Rs ${Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

interface Variance {
  id: string;
  partyName: string;
  stored: number;
  computed: number;
  drift: number;
  hasPayments: boolean;
}

async function main() {
  if (isProd && APPLY && !PROD_OK) {
    console.error(
      "\nRefusing to --apply against production without --i-understand-prod.\n" +
        "Read the dry-run report first. This rewrites customer ledgers.\n"
    );
    process.exit(1);
  }

  await connectDB();

  const partyFilter: Record<string, unknown> = {};
  if (userArg) partyFilter.user = new Types.ObjectId(userArg);

  const parties = await Party.find(partyFilter)
    .select("partyName user balance openingBalance openingBalanceType")
    .lean();

  if (!parties.length) {
    console.log("No parties matched. Nothing to do.");
    return;
  }

  const partyIds = parties.map((p: any) => p._id);
  const groupByParty = [
    { $group: { _id: "$partyId", total: { $sum: "$dueAmount" } } },
  ];

  // One aggregation per source rather than a query per party — N+1 over a
  // ledger is how a reconciliation job becomes an outage.
  const [saleAgg, purchaseAgg, paymentAgg] = await Promise.all([
    SaleInvoice.aggregate([
      { $match: { partyId: { $in: partyIds }, status: { $ne: "VOID" } } },
      ...groupByParty,
    ]),
    PurchaseInvoice.aggregate([
      { $match: { partyId: { $in: partyIds }, status: { $ne: "VOID" } } },
      ...groupByParty,
    ]),
    Payment.aggregate([
      { $match: { partyId: { $in: partyIds } } },
      {
        $group: {
          _id: { partyId: "$partyId", type: "$type" },
          total: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  const src = new Map<
    string,
    { saleDue: number; purchaseDue: number; paymentIn: number; paymentOut: number }
  >();
  const bucket = (id: unknown) => {
    const k = String(id);
    let e = src.get(k);
    if (!e) {
      e = { saleDue: 0, purchaseDue: 0, paymentIn: 0, paymentOut: 0 };
      src.set(k, e);
    }
    return e;
  };
  for (const r of saleAgg as any[]) bucket(r._id).saleDue += num(r.total);
  for (const r of purchaseAgg as any[]) bucket(r._id).purchaseDue += num(r.total);
  for (const r of paymentAgg as any[]) {
    const e = bucket(r._id.partyId);
    if (r._id.type === "PAYMENT_IN") e.paymentIn += num(r.total);
    else e.paymentOut += num(r.total);
  }

  const variances: Variance[] = [];
  let matched = 0;

  for (const p of parties as any[]) {
    const s = src.get(String(p._id));
    const computed = computePartyBalance({
      openingBalance: p.openingBalance,
      openingBalanceType: p.openingBalanceType,
      ...s,
    });
    const stored = toPaise(num(p.balance));
    const drift = toPaise(computed - stored);
    if (drift === 0) {
      matched++;
      continue;
    }
    variances.push({
      id: String(p._id),
      partyName: p.partyName || "(unnamed)",
      stored,
      computed,
      drift,
      hasPayments: !!s && (s.paymentIn > 0 || s.paymentOut > 0),
    });
  }

  variances.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

  console.log(`\n${"=".repeat(78)}`);
  console.log(`PARTY BALANCE RECONCILIATION  —  ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Database: ${isProd ? "PRODUCTION" : "local/dev"}`);
  console.log(`${"=".repeat(78)}\n`);
  console.log(`Parties examined : ${parties.length}`);
  console.log(`Already correct  : ${matched}`);
  console.log(`Needing repair   : ${variances.length}\n`);

  if (variances.length) {
    const explained = variances.filter((v) => v.hasPayments).length;
    console.log(
      `Of those, ${explained} have payment history (the known BR-09 cause) and ` +
        `${variances.length - explained} do not — investigate any in the second ` +
        `group before applying, they indicate a different bug.\n`
    );
    console.log(
      `${"Party".padEnd(28)}${"Stored".padStart(16)}${"Correct".padStart(16)}${"Drift".padStart(16)}  Pmts`
    );
    console.log("-".repeat(78));
    for (const v of variances.slice(0, 50)) {
      console.log(
        v.partyName.slice(0, 27).padEnd(28) +
          inr(v.stored).padStart(16) +
          inr(v.computed).padStart(16) +
          inr(v.drift).padStart(16) +
          (v.hasPayments ? "   yes" : "   NO")
      );
    }
    if (variances.length > 50) {
      console.log(`... and ${variances.length - 50} more`);
    }
    const net = toPaise(variances.reduce((s, v) => s + v.drift, 0));
    console.log("-".repeat(78));
    console.log(`Net correction across all parties: ${inr(net)}\n`);
  }

  if (!APPLY) {
    console.log(
      variances.length
        ? "DRY RUN — nothing was written. Re-run with --apply once this looks right.\n"
        : "Nothing to repair. Balances already reconcile.\n"
    );
    return;
  }

  if (!variances.length) {
    console.log("Nothing to apply.\n");
    return;
  }

  const ops = variances.map((v) => ({
    updateOne: {
      filter: { _id: new Types.ObjectId(v.id) },
      update: { $set: { balance: v.computed } },
    },
  }));
  const res = await Party.bulkWrite(ops, { ordered: false });
  console.log(`APPLIED — ${res.modifiedCount} party balances corrected.\n`);
  console.log("Re-run without --apply to confirm the ledger now reconciles.\n");
}

main()
  .catch((err) => {
    console.error("\nReconciliation failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
