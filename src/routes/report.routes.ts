import { Router } from "express";
import {
  getSalesSummary,
  getPurchaseSummary,
  getDaybook,
  getPartyOutstanding,
  getPartyLedger,
  getStockSummary,
  getReceivablesAging,
} from "../controllers/report.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.get("/sales-summary", asyncHandler(getSalesSummary));
router.get("/purchase-summary", asyncHandler(getPurchaseSummary));
router.get("/daybook", asyncHandler(getDaybook));
router.get("/party-outstanding", asyncHandler(getPartyOutstanding));
router.get("/party-ledger/:partyId", asyncHandler(getPartyLedger));
router.get("/stock-summary", asyncHandler(getStockSummary));
router.get("/receivables-aging", asyncHandler(getReceivablesAging));

export default router;
