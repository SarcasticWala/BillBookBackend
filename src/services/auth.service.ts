import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { signToken } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";
import { isAdminPhone } from "../middleware/auth";
import { verifyOtp, checkOtp } from "./otp.service";

const BCRYPT_ROUNDS = 10;

/** Strip the password hash before returning a user to the client. */
function sanitize(user: any) {
  const { password, ...rest } = user;
  return { ...rest, id: String(user._id) };
}

// Store the phone in E.164 so admin checks (ADMIN_PHONES) keep matching.
const toE164 = (phone: string) => `+91${String(phone).replace(/\D/g, "").slice(-10)}`;

export async function register(body: {
  name: string;
  email: string;
  password: string;
  phone: string;
  otp: string;
}) {
  const email = body.email.toLowerCase().trim();

  // Verify email ownership via OTP FIRST — so a caller without a valid code
  // can't probe which emails are already registered (account enumeration).
  await verifyOtp(email, body.otp);

  if (await User.findOne({ email }).lean()) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

  let created;
  try {
    created = await User.create({
      name: body.name.trim(),
      email,
      password: passwordHash,
      phone: toE164(body.phone), // collected, not OTP-verified
      emailVerified: true,
    });
  } catch (err: any) {
    if (err?.code === 11000) throw new ApiError(409, "This email or phone is already registered");
    throw err;
  }

  const user = created.toObject();
  const token = signToken({ userId: String(user._id), phone: user.phone });
  return { token, user: sanitize(user) };
}

/** Verify an email OTP without consuming it (for a dedicated verify step). */
export async function verifyEmailOtp(body: { email: string; otp: string }) {
  await checkOtp(body.email.toLowerCase().trim(), body.otp);
  return { verified: true };
}

export async function login(body: { email: string; password: string }) {
  const email = body.email.toLowerCase().trim();
  // password has select:false, so request it explicitly for comparison.
  const user = await User.findOne({ email }).select("+password").lean();
  if (!user || !user.password) throw new ApiError(401, "Invalid email or password");

  const matches = await bcrypt.compare(body.password, user.password);
  if (!matches) throw new ApiError(401, "Invalid email or password");

  const token = signToken({ userId: String(user._id), phone: user.phone });
  return { token, user: sanitize(user) };
}

export async function resetPassword(body: {
  email: string;
  otp: string;
  newPassword: string;
}) {
  const email = body.email.toLowerCase().trim();

  // Verify ownership of the email via OTP, then require the account to exist.
  await verifyOtp(email, body.otp);
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(400, "No account found for this email");

  user.password = await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS);
  await user.save();

  const obj = user.toObject();
  const token = signToken({ userId: String(obj._id), phone: obj.phone });
  return { token, user: sanitize(obj) };
}

export async function getProfile(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) throw new ApiError(404, "User not found");
  return { ...sanitize(user), isAdmin: isAdminPhone(user.phone) };
}

export async function updateProfile(userId: string, body: Record<string, unknown>) {
  const allowed = ["name", "email", "businessName", "gstin", "state", "address", "logoUrl"] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) update[key] = body[key];

  const user = await User.findByIdAndUpdate(userId, update, { new: true }).lean();
  if (!user) throw new ApiError(404, "User not found");
  return sanitize(user);
}
