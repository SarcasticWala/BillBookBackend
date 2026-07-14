import { Router } from "express";
import {
  createPurchase,
  getPurchaseInvoices,
} from "../controllers/purchase.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { purchaseCreateSchema } from "../validation/schemas";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.post(
  "/create-purchase",
  validate(purchaseCreateSchema),
  asyncHandler(createPurchase)
);
router.get("/purchase-invoices", asyncHandler(getPurchaseInvoices));

export default router;
