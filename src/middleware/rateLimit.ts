import rateLimit from "express-rate-limit";

// Tight limit on auth to blunt login/register abuse.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later" },
});

// Extra-tight limit specifically on OTP requests to prevent email spam / abuse.
// Complements the per-email 30s cooldown enforced in the OTP service.
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // at most 10 code requests per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification code requests, please try again later" },
});

// Generous global limit as a safety backstop for the API.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please slow down" },
});
