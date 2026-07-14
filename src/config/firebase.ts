import admin from "firebase-admin";
import { env } from "./env";

// Firebase is no longer used for authentication (email/password + backend OTP).
// This is kept only for backward compatibility and initialises lazily/safely —
// it no-ops when Firebase credentials are absent, so the backend boots without them.
const hasCreds =
  !!env.firebase.projectId && !!env.firebase.clientEmail && !!env.firebase.privateKey;

if (hasCreds && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    }),
  });
}

export const firebaseAuth = hasCreds ? admin.auth() : null;
export default admin;
