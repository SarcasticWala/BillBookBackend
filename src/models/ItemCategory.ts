import { Schema, model, InferSchemaType } from "mongoose";

const itemCategorySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

itemCategorySchema.index({ user: 1, name: 1 }, { unique: true });
itemCategorySchema.index({ user: 1, createdAt: -1 });

export type ItemCategoryDoc = InferSchemaType<typeof itemCategorySchema>;
export const ItemCategory = model("ItemCategory", itemCategorySchema);
