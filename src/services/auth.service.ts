import { firebaseAuth } from "../config/firebase";
import { User } from "../models/User";
import { signToken } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";
import { isAdminPhone } from "../middleware/auth";

export async function loginWithFirebaseIdToken(idToken: string) {
  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(idToken);
  } catch {
    throw new ApiError(401, "Invalid Firebase ID token");
  }
  if (!decoded.uid) throw new ApiError(401, "Token missing uid");

  const phone = decoded.phone_number ?? "";
  const user = await User.findOneAndUpdate(
    { firebaseUid: decoded.uid },
    { $setOnInsert: { firebaseUid: decoded.uid, phone } },
    { new: true, upsert: true }
  ).lean();

  const token = signToken({ userId: String(user._id), phone: user.phone });
  return { token, user: { ...user, id: String(user._id) } };
}

export async function getProfile(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) throw new ApiError(404, "User not found");
  return { ...user, id: String(user._id), isAdmin: isAdminPhone(user.phone) };
}

export async function updateProfile(userId: string, body: Record<string, unknown>) {
  const allowed = ["name", "email", "businessName", "gstin", "state", "address", "logoUrl"] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) update[key] = body[key];

  const user = await User.findByIdAndUpdate(userId, update, { new: true }).lean();
  if (!user) throw new ApiError(404, "User not found");
  return { ...user, id: String(user._id) };
}
