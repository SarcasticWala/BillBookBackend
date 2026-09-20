import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value == null) return fallback;
  return value === "true" || value === "1";
}

const nodeEnv = optional("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

// Production connects to the existing MongoDB exactly as before (MONGO_URI,
// required — unchanged behavior). Any other environment (local dev, test, or
// a missing/unknown NODE_ENV) defaults to a local MongoDB instance instead,
// so it can never accidentally end up pointing at production. Override with
// MONGO_URI_LOCAL if local/test needs a different database.
const mongoUri = isProduction
  ? required("MONGO_URI")
  : optional("MONGO_URI_LOCAL", "mongodb://127.0.0.1:27017/billbook");

export const env = {
  nodeEnv,
  port: parseInt(optional("PORT", "5000"), 10),
  corsOrigins: optional("CORS_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  // Phone numbers (E.164, e.g. +919800054895) treated as admins.
  adminPhones: optional("ADMIN_PHONES", "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean),

  mongoUri,

  // New modules ship dark by default — each is off until explicitly enabled.
  flags: {
    scheduler: bool("FEATURE_SCHEDULER", false),
    posBilling: bool("FEATURE_POS_BILLING", false),
    automatedBills: bool("FEATURE_AUTOMATED_BILLS", false),
    eInvoicing: bool("FEATURE_E_INVOICING", false),
  },

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: optional("JWT_EXPIRES_IN", "7d"),

  cloudinary: {
    cloudName: required("CLOUDINARY_CLOUD_NAME"),
    apiKey: required("CLOUDINARY_API_KEY"),
    apiSecret: required("CLOUDINARY_API_SECRET"),
  },

  // Email OTP delivery. Provider preference: Brevo HTTP API -> Gmail API ->
  // SMTP (local fallback). All HTTP options work on hosts like Render that
  // block outbound SMTP. When none is configured, no email is sent and (in dev)
  // the code is returned instead.
  brevoApiKey: optional("BREVO_API_KEY", ""),
  gmail: {
    clientId: optional("GOOGLE_CLIENT_ID", ""),
    clientSecret: optional("GOOGLE_CLIENT_SECRET", ""),
    refreshToken: optional("GOOGLE_REFRESH_TOKEN", ""),
  },
  smtp: {
    host: optional("SMTP_HOST", ""),
    port: parseInt(optional("SMTP_PORT", "587"), 10),
    user: optional("SMTP_USER", ""),
    pass: optional("SMTP_PASS", ""),
    // Sender address (your Gmail). Used as the "From" for both Gmail API and SMTP.
    from: optional("SMTP_FROM", ""),
  },

  // GST e-Invoicing (IRP submission). "MOCK" simulates realistic IRN/QR
  // responses for development; switch to "NIC" only once real NIC e-invoice
  // API credentials are configured below. Never hardcode these credentials.
  eInvoice: {
    provider: optional("EINVOICE_PROVIDER", "MOCK"),
    // Informational only (this app doesn't track turnover) — surfaced in the
    // UI as a reminder of when e-invoicing becomes a legal requirement.
    turnoverThresholdCr: parseFloat(optional("EINVOICE_TURNOVER_THRESHOLD_CR", "5")),
    nic: {
      gstin: optional("EINVOICE_NIC_GSTIN", ""),
      username: optional("EINVOICE_NIC_USERNAME", ""),
      password: optional("EINVOICE_NIC_PASSWORD", ""),
      clientId: optional("EINVOICE_NIC_CLIENT_ID", ""),
      clientSecret: optional("EINVOICE_NIC_CLIENT_SECRET", ""),
    },
  },
};

export const isProd = isProduction;
