import { Router } from "express";
import {
  sendOtp,
  verifyOtp,
  register,
  login,
  resetPassword,
  me,
  updateProfile,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { validate } from "../middleware/validate";
import { otpLimiter } from "../middleware/rateLimit";
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from "../validation/schemas";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/send-otp", otpLimiter, validate(sendOtpSchema), asyncHandler(sendOtp));
router.post("/verify-otp", otpLimiter, validate(verifyOtpSchema), asyncHandler(verifyOtp));
router.post("/register", validate(registerSchema), asyncHandler(register));
router.post("/login", validate(loginSchema), asyncHandler(login));
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  asyncHandler(resetPassword)
);
router.get("/me", requireAuth, asyncHandler(me));
router.put("/profile", requireAuth, upload.single("logo"), asyncHandler(updateProfile));

export default router;
