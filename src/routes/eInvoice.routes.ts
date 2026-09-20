import { Router } from "express";
import * as controller from "../controllers/eInvoice.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.post("/enable", asyncHandler(controller.setEnabled));
router.post("/invoices/:id/submit", asyncHandler(controller.submit));
router.post("/invoices/:id/cancel", asyncHandler(controller.cancel));
router.get("/gstr1-summary", asyncHandler(controller.gstr1));

export default router;
