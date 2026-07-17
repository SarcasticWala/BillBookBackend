import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Otp } from "../models/Otp";
import { ApiError } from "../utils/ApiError";
import { isProd } from "../config/env";
import { sendOtpEmail } from "./email.service";

const OTP_TTL_MS = 5 * 60 * 1000; // code valid for 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // 30s between sends
const MAX_ATTEMPTS = 5;

const normalizeEmail = (email: string) => String(email).toLowerCase().trim();

function generateCode(): string {
  // Cryptographically random 6-digit code.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function requestOtp(rawEmail: string): Promise<{ devCode?: string }> {
  const email = normalizeEmail(rawEmail);

  const existing = await Otp.findOne({ email });
  if (existing) {
    const sinceLast = Date.now() - existing.lastSentAt.getTime();
    if (sinceLast < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000);
      throw new ApiError(429, `Please wait ${wait}s before requesting another code`);
    }
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 8);
  await Otp.findOneAndUpdate(
    { email },
    { email, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0, lastSentAt: new Date() },
    { upsert: true }
  );

  const sent = await sendOtpEmail(email, code);

  // If no email was sent (SMTP not configured) and we're not in production,
  // return the code so the flow stays testable. In production without SMTP the
  // caller simply can't receive a code (misconfiguration).
  if (!sent && !isProd) return { devCode: code };
  return {};
}

/**
 * Validate the OTP without consuming it. Throws on any failure (missing,
 * expired, too many attempts, mismatch). Used to confirm the code at a
 * dedicated verify step before the caller proceeds (e.g. reset-password
 * splits OTP verification and the actual reset into two screens).
 */
async function assertValidOtp(email: string, code: string): Promise<void> {
  const record = await Otp.findOne({ email });
  if (!record) throw new ApiError(400, "Please request a verification code first");

  if (record.expiresAt.getTime() < Date.now()) {
    await Otp.deleteOne({ email });
    throw new ApiError(400, "Code has expired, please request a new one");
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await Otp.deleteOne({ email });
    throw new ApiError(429, "Too many incorrect attempts, please request a new code");
  }

  const matches = await bcrypt.compare(String(code), record.codeHash);
  if (!matches) {
    await Otp.updateOne({ email }, { $inc: { attempts: 1 } });
    throw new ApiError(400, "Invalid code");
  }
}

/** Verify without consuming — the code stays valid for a later verifyOtp(). */
export async function checkOtp(rawEmail: string, code: string): Promise<void> {
  await assertValidOtp(normalizeEmail(rawEmail), String(code));
}

/** Verify (and consume) the OTP for an email. Throws on any failure. */
export async function verifyOtp(rawEmail: string, code: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  await assertValidOtp(email, String(code));
  await Otp.deleteOne({ email }); // single-use
}
