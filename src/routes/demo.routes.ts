import { Router } from "express";
import {
  bookDemo,
  getDemos,
  getAllDemos,
  updateDemoStatus,
} from "../controllers/demo.controller";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { idempotency } from "../middleware/idempotency";
import { demoBookSchema, demoStatusSchema } from "../validation/schemas";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.post("/book", validate(demoBookSchema), idempotency, asyncHandler(bookDemo));
router.get("/list", asyncHandler(getDemos));

// Admin-only: view every request and update its status.
router.get("/admin/list", requireAdmin, asyncHandler(getAllDemos));
router.patch(
  "/admin/:id/status",
  requireAdmin,
  validate(demoStatusSchema),
  asyncHandler(updateDemoStatus)
);

export default router;
