import { Schema, model, InferSchemaType } from "mongoose";

/**
 * Indian state/city pairs. The frontend's AddressModal reads
 * `data.states[].state` and `data.cities[].city` (filtered by `.state`),
 * so getLocations derives both lists from this collection.
 */
const locationSchema = new Schema(
  {
    state: { type: String, required: true, index: true },
    city: { type: String, default: "" },
    stateCode: { type: String, default: "" },
  },
  { timestamps: true }
);

locationSchema.index({ state: 1, city: 1 }, { unique: true });

export type LocationDoc = InferSchemaType<typeof locationSchema>;
export const Location = model("Location", locationSchema);
