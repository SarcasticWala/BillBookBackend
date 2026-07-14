import { Schema, model, InferSchemaType } from "mongoose";

const partyCategorySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

partyCategorySchema.index({ user: 1, name: 1 }, { unique: true });
partyCategorySchema.index({ user: 1, createdAt: -1 });

export type PartyCategoryDoc = InferSchemaType<typeof partyCategorySchema>;
export const PartyCategory = model("PartyCategory", partyCategorySchema);
