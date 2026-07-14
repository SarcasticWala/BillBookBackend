import { Schema, model, InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true, index: true },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    businessName: { type: String, default: "" },
    gstin: { type: String, default: "" },
    state: { type: String, default: "" },
    address: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
