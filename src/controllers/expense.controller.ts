import { Request, Response } from "express";
import { Types } from "mongoose";
import * as expenseService from "../services/expense.service";
import { ok, created } from "../utils/respond";

const uid = (req: Request) => new Types.ObjectId(req.userId);

export async function createExpense(req: Request, res: Response): Promise<void> {
  created(res, await expenseService.createExpense(uid(req), req.body ?? {}), "Expense created");
}

export async function getExpenses(req: Request, res: Response): Promise<void> {
  ok(res, await expenseService.listExpensesPaged(uid(req), req.query));
}

export async function deleteExpense(req: Request, res: Response): Promise<void> {
  ok(res, await expenseService.deleteExpense(uid(req), req.params.id), "Expense deleted");
}
