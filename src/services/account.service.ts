import { Types } from "mongoose";
import { Account } from "../models/Account";
import { AccountTransaction } from "../models/AccountTransaction";
import { ApiError } from "../utils/ApiError";
import { withId, withIds } from "../utils/serialize";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Ensure the user has a default cash account; create it once if missing. */
async function ensureCashAccount(userId: Types.ObjectId) {
  const existing = await Account.findOne({ user: userId, type: "CASH" });
  if (existing) return existing;
  return Account.create({
    user: userId,
    name: "Cash",
    type: "CASH",
    openingBalance: 0,
    balance: 0,
    isDefault: true,
  });
}

export async function listAccounts(userId: Types.ObjectId) {
  await ensureCashAccount(userId);
  const accounts = await Account.find({ user: userId })
    .sort({ isDefault: -1, createdAt: 1 })
    .lean();
  return withIds(accounts);
}

export async function createAccount(
  userId: Types.ObjectId,
  body: Record<string, any>
) {
  const name = String(body.name || "").trim();
  if (!name) throw new ApiError(400, "Account name is required");

  const type = String(body.type || "BANK").toUpperCase() === "CASH" ? "CASH" : "BANK";
  const openingBalance = num(body.openingBalance);

  const account = await Account.create({
    user: userId,
    name,
    type,
    openingBalance,
    balance: openingBalance,
    bankName: body.bankName || "",
    accountNumber: body.accountNumber || "",
    ifsc: body.ifsc || "",
    upiId: body.upiId || "",
    isDefault: false,
  });

  // Record the opening balance as an opening transaction so it shows in history.
  if (openingBalance !== 0) {
    await AccountTransaction.create({
      user: userId,
      account: account._id,
      type: openingBalance > 0 ? "IN" : "OUT",
      amount: Math.abs(openingBalance),
      description: "Opening balance",
    });
  }

  return withId(account.toObject());
}

export async function getAccount(userId: Types.ObjectId, id: string) {
  const account = await Account.findOne({ _id: id, user: userId }).lean();
  if (!account) throw new ApiError(404, "Account not found");
  return withId(account);
}

export async function updateAccount(
  userId: Types.ObjectId,
  id: string,
  body: Record<string, any>
) {
  const account = await Account.findOne({ _id: id, user: userId });
  if (!account) throw new ApiError(404, "Account not found");

  const name = String(body.name || "").trim();
  if (!name) throw new ApiError(400, "Account name is required");
  const type =
    String(body.type || account.type).toUpperCase() === "CASH" ? "CASH" : "BANK";

  // Editing the opening balance shifts the running balance by the same delta,
  // so recorded movements stay intact.
  if (body.openingBalance != null && body.openingBalance !== "") {
    const newOpening = num(body.openingBalance);
    const delta = newOpening - num(account.openingBalance);
    account.openingBalance = newOpening;
    account.balance = num(account.balance) + delta;
  }

  account.name = name;
  account.type = type;
  if (body.bankName != null) account.bankName = body.bankName;
  if (body.accountNumber != null) account.accountNumber = body.accountNumber;
  if (body.ifsc != null) account.ifsc = body.ifsc;
  if (body.upiId != null) account.upiId = body.upiId;

  await account.save();
  return withId(account.toObject());
}

export async function adjustMoney(
  userId: Types.ObjectId,
  accountId: string,
  body: Record<string, any>
) {
  const amount = num(body.amount);
  if (amount <= 0) throw new ApiError(400, "Amount must be greater than zero");
  const direction = String(body.type || "IN").toUpperCase() === "OUT" ? "OUT" : "IN";

  const account = await Account.findOne({ _id: accountId, user: userId });
  if (!account) throw new ApiError(404, "Account not found");

  // Don't let a reduction push the account negative.
  if (direction === "OUT" && amount > num(account.balance)) {
    throw new ApiError(
      400,
      `Amount exceeds available balance (₹${num(account.balance).toLocaleString("en-IN")})`
    );
  }

  const delta = direction === "IN" ? amount : -amount;
  account.balance = num(account.balance) + delta;
  await account.save();

  await AccountTransaction.create({
    user: userId,
    account: account._id,
    type: direction,
    amount,
    description: body.description || "",
    date: body.date ? new Date(body.date) : new Date(),
  });

  return withId(account.toObject());
}

export async function transferMoney(
  userId: Types.ObjectId,
  body: Record<string, any>
) {
  const amount = num(body.amount);
  if (amount <= 0) throw new ApiError(400, "Amount must be greater than zero");
  if (!body.fromAccountId || !body.toAccountId)
    throw new ApiError(400, "Both source and destination accounts are required");
  if (String(body.fromAccountId) === String(body.toAccountId))
    throw new ApiError(400, "Source and destination must be different accounts");

  const [from, to] = await Promise.all([
    Account.findOne({ _id: body.fromAccountId, user: userId }),
    Account.findOne({ _id: body.toAccountId, user: userId }),
  ]);
  if (!from || !to) throw new ApiError(404, "Account not found");

  // Can't transfer more than the source account holds.
  if (amount > num(from.balance)) {
    throw new ApiError(
      400,
      `Insufficient balance in ${from.name} (₹${num(from.balance).toLocaleString("en-IN")})`
    );
  }

  from.balance = num(from.balance) - amount;
  to.balance = num(to.balance) + amount;
  await Promise.all([from.save(), to.save()]);

  const date = body.date ? new Date(body.date) : new Date();
  const description = body.description || "";
  await AccountTransaction.create([
    {
      user: userId,
      account: from._id,
      type: "TRANSFER_OUT",
      amount,
      description,
      counterparty: to._id,
      date,
    },
    {
      user: userId,
      account: to._id,
      type: "TRANSFER_IN",
      amount,
      description,
      counterparty: from._id,
      date,
    },
  ]);

  return { from: withId(from.toObject()), to: withId(to.toObject()) };
}

export async function listTransactions(
  userId: Types.ObjectId,
  query: Record<string, any>
) {
  const filter: Record<string, any> = { user: userId };
  if (query.accountId) filter.account = query.accountId;
  const txns = await AccountTransaction.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(500)
    .populate("account", "name type")
    .populate("counterparty", "name type")
    .lean();
  return withIds(txns);
}

export async function deleteAccount(userId: Types.ObjectId, id: string) {
  const account = await Account.findOne({ _id: id, user: userId });
  if (!account) throw new ApiError(404, "Account not found");
  if (account.isDefault)
    throw new ApiError(400, "The default cash account cannot be deleted");

  await AccountTransaction.deleteMany({ user: userId, account: account._id });
  await account.deleteOne();
  return { id };
}
