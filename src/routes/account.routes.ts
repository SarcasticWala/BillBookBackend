import { Router } from "express";
import {
  getAccounts,
  createAccount,
  adjustMoney,
  transferMoney,
  getTransactions,
  deleteAccount,
} from "../controllers/account.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.get("/accounts", asyncHandler(getAccounts));
router.post("/accounts", asyncHandler(createAccount));
router.post("/accounts/:id/adjust", asyncHandler(adjustMoney));
router.delete("/accounts/:id", asyncHandler(deleteAccount));
router.post("/transfer", asyncHandler(transferMoney));
router.get("/transactions", asyncHandler(getTransactions));

export default router;
