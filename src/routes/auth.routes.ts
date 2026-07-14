import { Router } from "express";
import { login, me, updateProfile } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { validate } from "../middleware/validate";
import { loginSchema } from "../validation/schemas";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/login", validate(loginSchema), asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));
router.put("/profile", requireAuth, upload.single("logo"), asyncHandler(updateProfile));

export default router;
