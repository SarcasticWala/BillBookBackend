import { Router } from "express";
import {
  getAccounts,
  createAccount,
  getAccount,
  updateAccount,
  adjustMoney,
  transferMoney,
  getTransactions,
  deleteAccount,
} from "../controllers/account.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { idempotency } from "../middleware/idempotency";
import {
  accountCreateSchema,
  moneyAdjustSchema,
  transferSchema,
} from "../validation/schemas";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.get("/accounts", asyncHandler(getAccounts));
router.post(
  "/accounts",
  validate(accountCreateSchema),
  idempotency,
  asyncHandler(createAccount)
);
router.get("/accounts/:id", asyncHandler(getAccount));
router.put("/accounts/:id", validate(accountCreateSchema), asyncHandler(updateAccount));
router.post(
  "/accounts/:id/adjust",
  validate(moneyAdjustSchema),
  asyncHandler(adjustMoney)
);
router.delete("/accounts/:id", asyncHandler(deleteAccount));
router.post("/transfer", validate(transferSchema), asyncHandler(transferMoney));
router.get("/transactions", asyncHandler(getTransactions));

export default router;
