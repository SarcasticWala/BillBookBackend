import { Router } from "express";
import {
  createSale,
  getSaleInvoices,
  getSaleInvoicesPaged,
  getSaleInvoice,
  updateSale,
  deleteSale,
} from "../controllers/sale.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { saleCreateSchema } from "../validation/schemas";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.post("/create-sale", validate(saleCreateSchema), asyncHandler(createSale));
router.get("/sale-invoices", asyncHandler(getSaleInvoices));
router.get("/sale-invoices-paged", asyncHandler(getSaleInvoicesPaged));
router.get("/:id", asyncHandler(getSaleInvoice));
router.put("/:id", validate(saleCreateSchema), asyncHandler(updateSale));
router.delete("/:id", asyncHandler(deleteSale));

export default router;
