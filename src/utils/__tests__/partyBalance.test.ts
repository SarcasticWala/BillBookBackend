import assert from "node:assert";
import {
  applyOpeningBalanceChange,
  computePartyBalance,
  paymentBalanceDelta,
  signedOpeningBalance,
  splitReceivablePayable,
} from "../partyBalance";

// Opening balance: TO_PAY is stored negative, TO_COLLECT positive, and the
// sign is taken from the type rather than from the number's own sign.
{
  assert.strictEqual(signedOpeningBalance(5000, "TO_COLLECT"), 5000);
  assert.strictEqual(signedOpeningBalance(5000, "TO_PAY"), -5000);
  assert.strictEqual(signedOpeningBalance(-5000, "TO_PAY"), -5000);
  assert.strictEqual(signedOpeningBalance(-5000, "TO_COLLECT"), 5000);
  assert.strictEqual(signedOpeningBalance(undefined, "TO_COLLECT"), 0);
}

// Payment deltas: money in reduces a receivable, money out reduces a payable.
{
  assert.strictEqual(paymentBalanceDelta("PAYMENT_IN", 1000), -1000);
  assert.strictEqual(paymentBalanceDelta("PAYMENT_OUT", 1000), 1000);
  assert.strictEqual(paymentBalanceDelta("PAYMENT_IN", "1000"), -1000);
  // A zero/absent amount must come back as plain 0, never negative zero:
  // `-0` is not Object.is-equal to `0`, so it would break equality checks on a
  // value that is arithmetically fine. Asserting 0 pins the behaviour that
  // matters (no movement) instead of a floating-point sign bit.
  assert.strictEqual(paymentBalanceDelta("PAYMENT_IN", undefined), 0);
  assert.ok(Object.is(paymentBalanceDelta("PAYMENT_IN", 0), 0), "must not be -0");
}

// THE REGRESSION THIS FILE EXISTS FOR (BRD BR-09 / PRD PAY-03):
// a party with an invoice AND a standalone payment. Before the fix,
// Party.balance stayed at the invoice figure and ignored the payment, so the
// Dashboard's "To Collect" overstated what was actually owed.
{
  // Sold them ₹10,000; they paid ₹4,000 as a standalone Payment In.
  const balance = computePartyBalance({
    openingBalance: 0,
    openingBalanceType: "TO_COLLECT",
    saleDue: 10000,
    paymentIn: 4000,
  });
  assert.strictEqual(balance, 6000, "payment must reduce the receivable");
  assert.notStrictEqual(balance, 10000, "the pre-fix bug: payment ignored");
}

// Purchase side: we owe them, then we pay some of it off.
{
  const balance = computePartyBalance({
    purchaseDue: 8000,
    paymentOut: 3000,
  });
  assert.strictEqual(balance, -5000, "we still owe 5000");
  assert.strictEqual(splitReceivablePayable(balance).toPay, 5000);
  assert.strictEqual(splitReceivablePayable(balance).toCollect, 0);
}

// Opening balance participates, and a party can settle exactly to zero.
{
  const balance = computePartyBalance({
    openingBalance: 2000,
    openingBalanceType: "TO_COLLECT",
    saleDue: 3000,
    paymentIn: 5000,
  });
  assert.strictEqual(balance, 0);
  assert.strictEqual(splitReceivablePayable(balance).status, "SETTLED");
}

// A party can be both bought from and sold to; the net is what matters.
{
  const balance = computePartyBalance({
    saleDue: 10000,
    purchaseDue: 4000,
    paymentIn: 2000,
    paymentOut: 1000,
  });
  // 10000 - 4000 - 2000 + 1000
  assert.strictEqual(balance, 5000);
}

// Paise rounding: repeated thirds must not drift into floating-point dust.
{
  const balance = computePartyBalance({
    saleDue: 0.1,
    purchaseDue: 0.2,
  });
  assert.strictEqual(balance, -0.1, "0.1 - 0.2 must be exactly -0.1");
}

// Overpayment flips a receivable into a payable (we now owe them a refund).
{
  const balance = computePartyBalance({ saleDue: 1000, paymentIn: 1500 });
  assert.strictEqual(balance, -500);
  assert.strictEqual(splitReceivablePayable(balance).status, "TO_PAY");
}

// Garbage in must not produce NaN — the Dashboard sums these fields.
{
  const balance = computePartyBalance({
    openingBalance: "abc",
    saleDue: null,
    purchaseDue: undefined,
    paymentIn: {},
  });
  assert.strictEqual(balance, 0);
  assert.ok(!Number.isNaN(balance));
}

// REGRESSION: editing a party's opening balance must move `balance` with it.
// `updateParty` used to write `openingBalance` alone, leaving `balance`
// untouched, so the two desynced permanently and the party's outstanding
// stayed wrong by the size of the edit. This is the most likely origin of the
// unexplained Rs 5,000 drift the reconciliation report surfaced.
{
  // Party owes 5,118: 5,000 opening + 118 from an unpaid invoice.
  // The opening is corrected to 0 — the invoice effect must survive.
  const after = applyOpeningBalanceChange(
    5118,
    { amount: 5000, type: "TO_COLLECT" },
    { amount: 0, type: "TO_COLLECT" }
  );
  assert.strictEqual(after, 118, "invoice effect must survive the edit");
  assert.notStrictEqual(after, 5118, "the pre-fix bug: balance left untouched");
}

// Flipping only the direction (TO_COLLECT -> TO_PAY) swings by twice the amount.
{
  const after = applyOpeningBalanceChange(
    1000,
    { amount: 1000, type: "TO_COLLECT" },
    { amount: 1000, type: "TO_PAY" }
  );
  assert.strictEqual(after, -1000);
}

// Reversible: editing away and back must land exactly where it started,
// so repeated edits can't ratchet a balance up or down.
{
  const start = 250;
  const away = applyOpeningBalanceChange(
    start,
    { amount: 0, type: "TO_COLLECT" },
    { amount: 5000, type: "TO_COLLECT" }
  );
  const back = applyOpeningBalanceChange(
    away,
    { amount: 5000, type: "TO_COLLECT" },
    { amount: 0, type: "TO_COLLECT" }
  );
  assert.strictEqual(away, 5250);
  assert.strictEqual(back, start);
}

console.log("partyBalance.test.ts: all assertions passed");
