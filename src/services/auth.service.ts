import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { signToken } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";
import { isAdminPhone } from "../middleware/auth";
import { verifyOtp, normalizePhone } from "./otp.service";

const BCRYPT_ROUNDS = 10;

/** Strip the password hash before returning a user to the client. */
function sanitize(user: any) {
  const { password, ...rest } = user;
  return { ...rest, id: String(user._id) };
}

const last10 = (s: string) => String(s).replace(/\D/g, "").slice(-10);

export async function register(body: {
  name: string;
  email: string;
  password: string;
  phone: string;
  otp: string;
}) {
  const email = body.email.toLowerCase().trim();

  if (await User.findOne({ email }).lean()) {
    throw new ApiError(409, "An account with this email already exists");
  }

  // Verify the phone via our backend OTP before creating the account.
  await verifyOtp(body.phone, body.otp);
  const phone = normalizePhone(body.phone);

  const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

  let created;
  try {
    created = await User.create({
      name: body.name.trim(),
      email,
      password: passwordHash,
      phone, // store E.164, consistent with JWT + admin checks
      phoneVerified: true,
    });
  } catch (err: any) {
    if (err?.code === 11000) throw new ApiError(409, "This email or phone is already registered");
    throw err;
  }

  const user = created.toObject();
  const token = signToken({ userId: String(user._id), phone: user.phone });
  return { token, user: sanitize(user) };
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
  phone: string;
  otp: string;
  newPassword: string;
}) {
  const email = body.email.toLowerCase().trim();

  const user = await User.findOne({ email });
  // Verify the OTP for the submitted phone, then require it to match this
  // account's phone — so a valid OTP for a different number can't reset it.
  await verifyOtp(body.phone, body.otp);
  if (!user || last10(user.phone) !== last10(body.phone)) {
    throw new ApiError(400, "Phone number does not match this account");
  }

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
