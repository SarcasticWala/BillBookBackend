import { Router } from "express";
import { checkoutPos } from "../controllers/pos.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { idempotency } from "../middleware/idempotency";
import { posCheckoutSchema } from "../validation/schemas";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.post(
  "/checkout",
  validate(posCheckoutSchema),
  idempotency,
  asyncHandler(checkoutPos)
);

export default router;
