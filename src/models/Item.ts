import { Schema, model, Types, InferSchemaType } from "mongoose";

/**
 * Items are stored with internal fields and mapped to the frontend's read
 * shape by item.service (itemName/serviceName, gstRate:{value}, netQuantity,
 * code, category). Write payloads (itemName, hasSerialisationOn, itemSerialNos,
 * productAlertValue, itemCatagory...) are mapped in on create.
 */
const itemSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    itemType: { type: String, enum: ["PRODUCT", "SERVICE"], default: "PRODUCT" },

    name: { type: String, required: true },
    isOnlineVisible: { type: Boolean, default: false },
    itemProductType: { type: String, default: "NEW" }, // NEW | OLD
    isPreowned: { type: Boolean, default: false },

    categoryName: { type: String, default: "" },

    // Pricing
    salePrice: { type: Number, default: 0 },
    purchasePrice: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 }, // percent, exposed to client as { value }
    isSaleTaxApplicable: { type: Boolean, default: false },
    isPurchaseTaxApplicable: { type: Boolean, default: false },
    unit: { type: String, default: "PCS" },

    // Codes
    itemCode: { type: String, default: "" },
    hsnCode: { type: String, default: "" },
    sacCode: { type: String, default: "" },
    serviceCode: { type: String, default: "" },

    // Stock (products)
    openingStock: { type: Number, default: 0 },
    stock: { type: Number, default: 0 }, // exposed as netQuantity
    productAlertValue: { type: Number, default: 0 },
    isAlertEnabled: { type: Boolean, default: false },
    asOfDate: { type: Date, default: null },

    // Serialization
    hasSerialization: { type: Boolean, default: false },
    serialNos: { type: [String], default: [] },
    batteryPercentage: { type: String, default: "" },

    description: { type: String, default: "" },
    images: { type: [String], default: [] },
    imageUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

itemSchema.index({ user: 1, createdAt: -1 });
itemSchema.index({ user: 1, name: 1 });

export type ItemDoc = InferSchemaType<typeof itemSchema> & { _id: Types.ObjectId };
export const Item = model("Item", itemSchema);
