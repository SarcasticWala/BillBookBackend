import rateLimit from "express-rate-limit";
import { isProd } from "../config/env";

// Only enforce limits in production so local development/testing isn't blocked.
const skipOutsideProd = () => !isProd;

// Auth (login/register/reset). Generous enough for real use + testing,
// tight enough to blunt credential stuffing.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProd,
  message: { message: "Too many attempts, please try again in a few minutes" },
});

// OTP requests — layered on top of the per-email 30s cooldown in the OTP service.
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProd,
  message: { message: "Too many verification code requests, please try again in a few minutes" },
});

// Generous global backstop for the whole API.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProd,
  message: { message: "Too many requests, please slow down" },
});
