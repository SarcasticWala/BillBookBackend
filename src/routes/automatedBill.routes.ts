import { Router } from "express";
import * as controller from "../controllers/automatedBill.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { idempotency } from "../middleware/idempotency";
import {
  automatedBillTemplateCreateSchema,
  automatedBillTemplateUpdateSchema,
} from "../validation/schemas";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.post(
  "/templates",
  validate(automatedBillTemplateCreateSchema),
  idempotency,
  asyncHandler(controller.createTemplate)
);
router.get("/templates", asyncHandler(controller.listTemplates));
router.get("/templates/:id", asyncHandler(controller.getTemplate));
router.put(
  "/templates/:id",
  validate(automatedBillTemplateUpdateSchema),
  asyncHandler(controller.updateTemplate)
);
router.post("/templates/:id/pause", asyncHandler(controller.pauseTemplate));
router.post("/templates/:id/resume", asyncHandler(controller.resumeTemplate));
router.post("/templates/:id/cancel", asyncHandler(controller.cancelTemplate));

router.get("/runs", asyncHandler(controller.listRuns));
router.post("/runs/:id/post", asyncHandler(controller.postRun));
router.post("/runs/:id/cancel", asyncHandler(controller.cancelRun));
router.post("/runs/:id/retry", asyncHandler(controller.retryRun));

export default router;
