import { Schema, model, Types, InferSchemaType } from "mongoose";

/**
 * Stores the result of a create request keyed by a client-supplied
 * Idempotency-Key (scoped per user). A retry with the same key replays the
 * stored response instead of creating a duplicate. Records auto-expire after
 * 24h via a TTL index.
 */
const idempotencyKeySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    key: { type: String, required: true },
    method: { type: String, default: "" },
    path: { type: String, default: "" },
    status: { type: String, enum: ["pending", "done"], default: "pending" },
    statusCode: { type: Number, default: 0 },
    response: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// One record per (user, key). The unique index also serves as the lock that
// lets the first request "claim" the key and later requests detect the dupe.
idempotencyKeySchema.index({ user: 1, key: 1 }, { unique: true });
// TTL: drop keys 24h after creation.
idempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export type IdempotencyKeyDoc = InferSchemaType<typeof idempotencyKeySchema> & {
  _id: Types.ObjectId;
};
export const IdempotencyKey = model("IdempotencyKey", idempotencyKeySchema);
