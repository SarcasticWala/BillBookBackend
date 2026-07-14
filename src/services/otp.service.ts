import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Otp } from "../models/Otp";
import { ApiError } from "../utils/ApiError";
import { isProd } from "../config/env";

const OTP_TTL_MS = 5 * 60 * 1000; // code valid for 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // 30s between sends
const MAX_ATTEMPTS = 5;

/** Normalise a 10-digit Indian mobile to E.164 (+91XXXXXXXXXX). */
export const normalizePhone = (phone: string): string =>
  `+91${String(phone).replace(/\D/g, "").slice(-10)}`;

const last10 = (s: string) => String(s).replace(/\D/g, "").slice(-10);

function generateCode(): string {
  // Cryptographically random 6-digit code.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Delivers the OTP. No SMS provider is wired yet, so in development the code is
 * returned to the caller for testing; in production this is where Twilio/MSG91
 * would send the SMS. The code is never logged.
 */
async function sendSms(_phone: string, _code: string): Promise<void> {
  // TODO: integrate an SMS provider for production delivery.
}

export async function requestOtp(rawPhone: string): Promise<{ devCode?: string }> {
  if (last10(rawPhone).length !== 10) {
    throw new ApiError(400, "Enter a valid 10-digit mobile number");
  }
  const phone = normalizePhone(rawPhone);

  const existing = await Otp.findOne({ phone });
  if (existing) {
    const sinceLast = Date.now() - existing.lastSentAt.getTime();
    if (sinceLast < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000);
      throw new ApiError(429, `Please wait ${wait}s before requesting another OTP`);
    }
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 8);
  await Otp.findOneAndUpdate(
    { phone },
    { phone, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0, lastSentAt: new Date() },
    { upsert: true }
  );

  await sendSms(phone, code);

  // Surface the code only in non-production so signup/reset can be tested
  // without an SMS provider.
  return isProd ? {} : { devCode: code };
}

/** Verify (and consume) the OTP for a phone. Throws on any failure. */
export async function verifyOtp(rawPhone: string, code: string): Promise<void> {
  const phone = normalizePhone(rawPhone);
  const record = await Otp.findOne({ phone });
  if (!record) throw new ApiError(400, "Please request an OTP first");

  if (record.expiresAt.getTime() < Date.now()) {
    await Otp.deleteOne({ phone });
    throw new ApiError(400, "OTP has expired, please request a new one");
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await Otp.deleteOne({ phone });
    throw new ApiError(429, "Too many incorrect attempts, please request a new OTP");
  }

  const matches = await bcrypt.compare(String(code), record.codeHash);
  if (!matches) {
    await Otp.updateOne({ phone }, { $inc: { attempts: 1 } });
    throw new ApiError(400, "Invalid OTP");
  }

  await Otp.deleteOne({ phone }); // single-use
}
