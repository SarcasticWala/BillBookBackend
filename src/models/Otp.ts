import { Schema, model, InferSchemaType } from "mongoose";

// One active OTP per email. The code itself is stored hashed (never in
// plaintext), with a short expiry and an attempt counter to blunt brute force.
const otpSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Safety-net cleanup: drop records an hour past expiry.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export type OtpDoc = InferSchemaType<typeof otpSchema>;
export const Otp = model("Otp", otpSchema);
