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

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
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

  mongoUri: required("MONGO_URI"),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: optional("JWT_EXPIRES_IN", "7d"),

  // Firebase is no longer used for auth (email/password + backend OTP). These
  // are optional so the backend boots without Firebase credentials.
  firebase: {
    projectId: optional("FIREBASE_PROJECT_ID", ""),
    clientEmail: optional("FIREBASE_CLIENT_EMAIL", ""),
    // Env-stored keys escape newlines; restore them for the SDK.
    privateKey: optional("FIREBASE_PRIVATE_KEY", "").replace(/\\n/g, "\n"),
  },

  cloudinary: {
    cloudName: required("CLOUDINARY_CLOUD_NAME"),
    apiKey: required("CLOUDINARY_API_KEY"),
    apiSecret: required("CLOUDINARY_API_SECRET"),
  },
};

export const isProd = env.nodeEnv === "production";
