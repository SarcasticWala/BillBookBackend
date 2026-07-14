import { Schema, model, InferSchemaType } from "mongoose";

// Measurement units (PCS, KG, BOX...). Global list.
const unitSchema = new Schema(
  {
    name: { type: String, required: true }, // e.g. "Pieces"
    shortName: { type: String, required: true }, // e.g. "PCS"
  },
  { timestamps: true }
);

export type UnitDoc = InferSchemaType<typeof unitSchema>;
export const Unit = model("Unit", unitSchema);
