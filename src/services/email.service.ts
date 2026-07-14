import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

let transporter: Transporter | null = null;

/** SMTP is configured only when host + credentials are present. */
export const emailConfigured = (): boolean =>
  !!(env.smtp.host && env.smtp.user && env.smtp.pass);

function getTransporter(): Transporter | null {
  if (!emailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
}

/**
 * Send the OTP email. Returns true if an email was actually dispatched. When
 * SMTP isn't configured it returns false (caller falls back to the dev code).
 * The OTP itself is never logged.
 */
export async function sendOtpEmail(to: string, code: string): Promise<boolean> {
  const tx = getTransporter();
  if (!tx) return false;

  await tx.sendMail({
    from: env.smtp.from || env.smtp.user,
    to,
    subject: "Your BillBook verification code",
    text: `Your BillBook verification code is ${code}. It expires in 5 minutes. If you didn't request this, ignore this email.`,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:420px;margin:auto">
      <h2 style="color:#111827;margin:0 0 8px">Verify your account</h2>
      <p style="color:#4b5563;font-size:14px">Use this code to continue. It expires in 5 minutes.</p>
      <div style="font-size:30px;font-weight:700;letter-spacing:8px;color:#2563eb;margin:16px 0">${code}</div>
      <p style="color:#9ca3af;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
    </div>`,
  });
  logger.info({ to }, "OTP email sent"); // logs recipient only, never the code
  return true;
}
