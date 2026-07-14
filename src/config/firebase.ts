import admin from "firebase-admin";
import { env } from "./env";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    }),
  });
  console.log("[firebase] Admin SDK initialized");
}

export const firebaseAuth = admin.auth();
export default admin;
