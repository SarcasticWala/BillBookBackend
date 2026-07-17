import { Types } from "mongoose";
import { Expense } from "../models/Expense";
import { ApiError } from "../utils/ApiError";
import { getPaging } from "../utils/pagination";
import { withId, withIds } from "../utils/serialize";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function createExpense(
  userId: Types.ObjectId,
  body: Record<string, any>
) {
  if (!body.expenseNumber || !String(body.expenseNumber).trim())
    throw new ApiError(400, "Expense number is required");
  const amount = num(body.amount);
  if (amount <= 0) throw new ApiError(400, "Amount must be greater than zero");

  const expense = await Expense.create({
    user: userId,
    expenseNumber: String(body.expenseNumber).trim(),
    expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
    category: body.category || "",
    partyName: body.partyName || "",
    amount,
    paymentMode: body.paymentMode || "CASH",
    notes: body.notes || "",
  });
  return withId(expense.toObject());
}

export async function listExpensesPaged(
  userId: Types.ObjectId,
  query: Record<string, any>
) {
  const { page, limit, skip } = getPaging(query);
  const filter: Record<string, any> = { user: userId };
  const search = String(query.search || "").trim();
  if (search) {
    filter.$or = [
      { expenseNumber: { $regex: search, $options: "i" } },
      { partyName: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ];
  }
  if (query.category) filter.category = query.category;

  const [docs, total, sumAgg] = await Promise.all([
    Expense.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  return {
    items: withIds(docs),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    summary: { total: sumAgg[0]?.total || 0 },
  };
}

export async function deleteExpense(userId: Types.ObjectId, id: string) {
  const expense = await Expense.findOne({ _id: id, user: userId });
  if (!expense) throw new ApiError(404, "Expense not found");
  await expense.deleteOne();
  return { id };
}
