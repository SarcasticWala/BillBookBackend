import { Schema, model, InferSchemaType } from "mongoose";

// GST tax rates. Global list (not per-user) so the picker is consistent.
const taxSchema = new Schema(
  {
    name: { type: String, required: true }, // e.g. "GST 18%"
    rate: { type: Number, required: true }, // e.g. 18
  },
  { timestamps: true }
);

export type TaxDoc = InferSchemaType<typeof taxSchema>;
export const Tax = model("Tax", taxSchema);
