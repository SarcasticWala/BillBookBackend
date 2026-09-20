import { Schema, model, Types, InferSchemaType } from "mongoose";

/**
 * Per-user, per-series atomic sequence — backs auto-generated document numbers
 * (POS, Automated Bills, ...) that have no human typing an invioceNo. Kept
 * separate per series so each gets its own counter and number prefix.
 */
const counterSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  series: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

counterSchema.index({ user: 1, series: 1 }, { unique: true });

export type CounterDoc = InferSchemaType<typeof counterSchema> & { _id: Types.ObjectId };
export const Counter = model("Counter", counterSchema);
