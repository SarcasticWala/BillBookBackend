import { Router } from "express";
import { getSummary } from "../controllers/dashboard.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.get("/summary", asyncHandler(getSummary));

export default router;
