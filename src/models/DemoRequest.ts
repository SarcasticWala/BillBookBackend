import { Schema, model, Types, InferSchemaType } from "mongoose";

// A demo booking raised by a logged-in user from the dashboard.
const demoRequestSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, default: "" },
    mobileNo: { type: String, required: true },
    businessName: { type: String, default: "" },
    interest: {
      type: String,
      enum: ["BILLING", "INVENTORY", "GST", "REPORTS", "OTHER"],
      default: "BILLING",
    },
    preferredDate: { type: String, default: "" }, // ISO date (YYYY-MM-DD)
    preferredTime: { type: String, default: "" }, // slot label
    attendees: { type: Number, default: 1 },
    message: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "SCHEDULED", "COMPLETED", "CANCELLED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

demoRequestSchema.index({ user: 1, createdAt: -1 });

export type DemoRequestDoc = InferSchemaType<typeof demoRequestSchema> & {
  _id: Types.ObjectId;
};
export const DemoRequest = model("DemoRequest", demoRequestSchema);
