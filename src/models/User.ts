import { Schema, model, InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    // Email + password are the primary credentials (backend/MongoDB auth).
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },

    // Phone is collected at signup (not OTP-verified). Email is verified via a
    // backend OTP before the account is created.
    phone: { type: String, required: true, index: true },
    emailVerified: { type: Boolean, default: false },

    name: { type: String, default: "" },
    businessName: { type: String, default: "" },
    gstin: { type: String, default: "" },
    state: { type: String, default: "" },
    address: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

// Unique on non-empty emails only, so legacy docs with a blank email don't break
// the index build. New signups always provide a real email.
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $gt: "" } } }
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
