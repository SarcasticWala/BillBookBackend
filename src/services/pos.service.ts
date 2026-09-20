import { Types } from "mongoose";
import { Party } from "../models/Party";
import { Account } from "../models/Account";
import { ApiError } from "../utils/ApiError";
import { nextSequence } from "../utils/sequence";
import { computeInvoiceTotals, InvoiceItemRow } from "./invoice.shared";
import { createSale } from "./sale.service";
import { adjustMoney } from "./account.service";

const WALKIN_PARTY_NAME = "Walk-in Customer";

/** The default counter-sale customer — created once per business, then reused. */
async function ensureWalkInParty(userId: Types.ObjectId) {
  const existing = await Party.findOne({ user: userId, partyName: WALKIN_PARTY_NAME });
  if (existing) return existing;
  return Party.create({ user: userId, partyName: WALKIN_PARTY_NAME, partyType: "CUSTOMER" });
}

/**
 * POS checkout. A POS sale IS a sales invoice — this delegates to the exact
 * same createSale() every regular invoice uses (server-side totals, stock
 * decrement, invoice-number uniqueness), rather than re-implementing any of
 * it. On top of that it: defaults to a walk-in party when none is chosen,
 * generates a collision-free "POS-######" number (no cashier types one),
 * requires full payment (no counter credit), and posts the payment split
 * into the chosen Cash/Bank account(s) — the one thing a regular sale
 * doesn't do today.
 */
export async function checkoutPos(userId: Types.ObjectId, body: Record<string, any>) {
  const rows: InvoiceItemRow[] = Array.isArray(body.itemDetails) ? body.itemDetails : [];
  if (!rows.length) throw new ApiError(400, "At least one item is required");

  const payments: Array<{ accountId: string; amount: number }> = Array.isArray(
    body.payments
  )
    ? body.payments
    : [];
  if (!payments.length) throw new ApiError(400, "At least one payment is required");

  const paidTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Pre-check against the same server-authoritative total createSale() will
  // compute, so we can reject an underpaid checkout before writing anything.
  const t = computeInvoiceTotals(rows, body, paidTotal);
  if (t.dueAmount > 0) {
    throw new ApiError(
      400,
      `Payment (₹${paidTotal}) does not cover the total (₹${t.grand}) — POS sales must be paid in full`
    );
  }

  // Validate every account up front — the invoice and its payments are
  // written in separate steps (no multi-document transaction, matching the
  // rest of this codebase), so catching a bad accountId here avoids leaving
  // a sale on record with an unposted payment split.
  const accountIds = [...new Set(payments.map((p) => String(p.accountId)))];
  const foundAccounts = await Account.countDocuments({
    _id: { $in: accountIds },
    user: userId,
  });
  if (foundAccounts !== accountIds.length) {
    throw new ApiError(404, "One or more payment accounts were not found");
  }

  let party;
  if (body.partyId) {
    party = await Party.findOne({ _id: body.partyId, user: userId }).lean();
    if (!party) throw new ApiError(404, "Party not found");
  } else {
    party = await ensureWalkInParty(userId);
  }

  const invioceNo = await nextSequence(userId, "POS", "POS");

  const invoice = await createSale(userId, {
    ...body,
    partyId: String(party._id),
    invioceNo,
    receivedAmount: paidTotal,
    // Enforced above: payment must cover the full total, so every POS sale
    // is fully paid by construction.
    isFullyPaid: true,
    channel: "POS",
  });

  // The register: money changes hands right now, unlike a regular invoice's
  // dues — post each payment split into its Cash/Bank account.
  for (const p of payments) {
    await adjustMoney(userId, String(p.accountId), {
      type: "IN",
      amount: Number(p.amount) || 0,
      description: `POS sale ${invioceNo}`,
    });
  }

  return invoice;
}
