import { Router } from "express";
import {
  createExpense,
  getExpenses,
  deleteExpense,
} from "../controllers/expense.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { idempotency } from "../middleware/idempotency";
import { expenseCreateSchema } from "../validation/schemas";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.get("/list", asyncHandler(getExpenses));
router.post("/create", validate(expenseCreateSchema), idempotency, asyncHandler(createExpense));
router.delete("/:id", asyncHandler(deleteExpense));

export default router;
