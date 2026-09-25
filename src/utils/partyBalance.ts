/**
 * Party balance arithmetic — the single source of truth for what a party owes.
 *
 * Sign convention (matches `Party.balance` and every existing caller):
 *   positive = the party owes us      (receivable, "TO_COLLECT")
 *   negative = we owe the party       (payable,    "TO_PAY")
 *
 * Deltas applied by the rest of the system:
 *   sale invoice      +dueAmount   they owe us more        (sale.service)
 *   purchase invoice  -dueAmount   we owe them more        (purchase.service)
 *   PAYMENT_IN        -amount      they paid us, so they owe less
 *   PAYMENT_OUT       +amount      we paid them, so we owe less
 *
 * The payment rows are the ones that were historically missing: invoices kept
 * `Party.balance` in step but a standalone `Payment` never touched it, so the
 * stored field drifted for any party with payment history — and the Dashboard
 * reads that field directly. Keeping the arithmetic here, in one pure module,
 * is what lets the live path, the reports and the reconciliation script agree
 * by construction instead of by three separate re-implementations.
 */

export type PaymentType = "PAYMENT_IN" | "PAYMENT_OUT";
export type OpeningBalanceType = "TO_COLLECT" | "TO_PAY";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Money is stored in rupees; round to paise so repeated deltas can't drift.
 *
 * Normalises `-0` to `0`. Negative zero is a JavaScript artifact with no
 * meaning for money, but it is *not* `===` or `Object.is`-equal to `0`, so
 * letting it escape makes equality checks (and `assert.strictEqual`) fail on a
 * value that is arithmetically correct. Killing it here means no consumer has
 * to think about it.
 */
export const toPaise = (v: number): number => {
  const r = Math.round(v * 100) / 100;
  return r === 0 ? 0 : r;
};

/** Opening balance as a signed figure. */
export function signedOpeningBalance(
  amount: unknown,
  type: unknown
): number {
  const a = Math.abs(num(amount));
  return type === "TO_PAY" ? -a : a;
}

/**
 * How a single payment moves `Party.balance`.
 * PAYMENT_IN reduces a receivable; PAYMENT_OUT reduces a payable.
 */
export function paymentBalanceDelta(
  type: PaymentType,
  amount: unknown
): number {
  const a = num(amount);
  return toPaise(type === "PAYMENT_IN" ? -a : a);
}

export interface PartyBalanceInputs {
  openingBalance?: unknown;
  openingBalanceType?: unknown;
  /** Σ dueAmount of non-void sale invoices. */
  saleDue?: unknown;
  /** Σ dueAmount of non-void purchase invoices. */
  purchaseDue?: unknown;
  /** Σ amount of PAYMENT_IN rows. */
  paymentIn?: unknown;
  /** Σ amount of PAYMENT_OUT rows. */
  paymentOut?: unknown;
}

/**
 * Rebuild a party's true balance from source records.
 *
 * This is the authority. `Party.balance` is a cache of this value, maintained
 * incrementally on the write path; the reconciliation script compares the two
 * and the reports derive from this rather than trusting the cache.
 */
export function computePartyBalance(input: PartyBalanceInputs): number {
  const opening = signedOpeningBalance(
    input.openingBalance,
    input.openingBalanceType
  );
  return toPaise(
    opening +
      num(input.saleDue) -
      num(input.purchaseDue) -
      num(input.paymentIn) +
      num(input.paymentOut)
  );
}

/**
 * New running balance after a party's opening balance is edited.
 *
 * The opening balance is one component of `balance`, so changing it has to
 * move `balance` by the same amount. Editing `openingBalance` on its own left
 * the two silently desynced — permanently, since nothing recomputed afterwards
 * — and the party's outstanding stayed wrong by the size of the edit.
 *
 * Applies the *delta* rather than rebuilding from scratch, so every invoice and
 * payment effect already accumulated in `balance` survives the edit.
 */
export function applyOpeningBalanceChange(
  currentBalance: unknown,
  previous: { amount: unknown; type: unknown },
  next: { amount: unknown; type: unknown }
): number {
  const before = signedOpeningBalance(previous.amount, previous.type);
  const after = signedOpeningBalance(next.amount, next.type);
  return toPaise(num(currentBalance) - before + after);
}

/** Presentation split used by the Dashboard and the outstanding report. */
export function splitReceivablePayable(balance: number): {
  toCollect: number;
  toPay: number;
  status: "TO_COLLECT" | "TO_PAY" | "SETTLED";
} {
  const b = toPaise(num(balance));
  if (b > 0) return { toCollect: b, toPay: 0, status: "TO_COLLECT" };
  if (b < 0) return { toCollect: 0, toPay: Math.abs(b), status: "TO_PAY" };
  return { toCollect: 0, toPay: 0, status: "SETTLED" };
}
