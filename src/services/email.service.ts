import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

let transporter: Transporter | null = null;

const smtpConfigured = () => !!(env.smtp.host && env.smtp.user && env.smtp.pass);
const gmailConfigured = () =>
  !!(env.gmail.clientId && env.gmail.clientSecret && env.gmail.refreshToken && env.smtp.from);
const brevoConfigured = () => !!(env.brevoApiKey && env.smtp.from);

/** Email is deliverable if Brevo, the Gmail API, or SMTP is configured. */
export const emailConfigured = (): boolean =>
  brevoConfigured() || gmailConfigured() || smtpConfigured();

/**
 * Send via Brevo's HTTPS API (port 443) — works on Render, needs only an API
 * key (no OAuth). Sender (SMTP_FROM) must be a verified Brevo sender. Throws on
 * non-2xx.
 */
async function sendViaBrevo(to: string, code: string): Promise<void> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.brevoApiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: env.smtp.from, name: "BillBook" },
      to: [{ email: to }],
      subject: SUBJECT,
      textContent: textBody(code),
      htmlContent: htmlBody(code),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo send failed (${res.status})${detail ? ": " + detail : ""}`);
  }
}

const SUBJECT = "Your BillBook verification code";
const textBody = (code: string) =>
  `Your BillBook verification code is ${code}. It expires in 5 minutes. If you didn't request this, ignore this email.`;
const htmlBody = (code: string) =>
  `<div style="font-family:Inter,Arial,sans-serif;max-width:420px;margin:auto">
    <h2 style="color:#111827;margin:0 0 8px">Verify your account</h2>
    <p style="color:#4b5563;font-size:14px">Use this code to continue. It expires in 5 minutes.</p>
    <div style="font-size:30px;font-weight:700;letter-spacing:8px;color:#2563eb;margin:16px 0">${code}</div>
    <p style="color:#9ca3af;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
  </div>`;

/** Exchange the long-lived refresh token for a short-lived access token. */
async function getGmailAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.gmail.clientId,
      client_secret: env.gmail.clientSecret,
      refresh_token: env.gmail.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gmail token refresh failed (${res.status})${detail ? ": " + detail : ""}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Gmail token refresh returned no access_token");
  return json.access_token;
}

/**
 * Send via the Gmail REST API over HTTPS (port 443) — works on Render, which
 * blocks outbound SMTP. Uses OAuth2 (send-only scope). Throws on failure.
 */
async function sendViaGmailApi(to: string, code: string): Promise<void> {
  const accessToken = await getGmailAccessToken();
  const from = env.smtp.from;

  const mime = [
    `From: BillBook <${from}>`,
    `To: ${to}`,
    `Subject: ${SUBJECT}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    htmlBody(code),
  ].join("\r\n");

  // Gmail API expects a base64url-encoded raw RFC-822 message.
  const raw = Buffer.from(mime)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gmail API send failed (${res.status})${detail ? ": " + detail : ""}`);
  }
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
}

/**
 * Send the OTP email. Returns true if dispatched. Prefers the Gmail HTTPS API
 * (Render-friendly) and falls back to SMTP (local dev). Returns false only when
 * nothing is configured. The code itself is never logged.
 */
export async function sendOtpEmail(to: string, code: string): Promise<boolean> {
  if (brevoConfigured()) {
    await sendViaBrevo(to, code);
    logger.info({ to, via: "brevo" }, "OTP email sent");
    return true;
  }
  if (gmailConfigured()) {
    await sendViaGmailApi(to, code);
    logger.info({ to, via: "gmail-api" }, "OTP email sent");
    return true;
  }
  if (smtpConfigured()) {
    await getTransporter().sendMail({
      from: env.smtp.from || env.smtp.user,
      to,
      subject: SUBJECT,
      text: textBody(code),
      html: htmlBody(code),
    });
    logger.info({ to, via: "smtp" }, "OTP email sent");
    return true;
  }
  return false;
}
