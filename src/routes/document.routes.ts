import { Router } from "express";
import { create, list } from "../controllers/document.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.post("/create", asyncHandler(create));
router.get("/list", asyncHandler(list));

export default router;
