import { Router } from "express";
import {
  createPurchase,
  getPurchaseInvoices,
  getPurchaseInvoicesPaged,
  getPurchaseInvoice,
  updatePurchase,
  deletePurchase,
} from "../controllers/purchase.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { idempotency } from "../middleware/idempotency";
import { purchaseCreateSchema } from "../validation/schemas";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.post(
  "/create-purchase",
  validate(purchaseCreateSchema),
  idempotency,
  asyncHandler(createPurchase)
);
router.get("/purchase-invoices", asyncHandler(getPurchaseInvoices));
router.get("/purchase-invoices-paged", asyncHandler(getPurchaseInvoicesPaged));
router.get("/:id", asyncHandler(getPurchaseInvoice));
router.put(
  "/:id",
  validate(purchaseCreateSchema),
  asyncHandler(updatePurchase)
);
router.delete("/:id", asyncHandler(deletePurchase));

export default router;
