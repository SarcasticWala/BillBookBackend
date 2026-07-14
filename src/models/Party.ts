import { Schema, model, Types, InferSchemaType } from "mongoose";

// Stored with the frontend's own field names so reads match writes directly.
const addressSchema = new Schema(
  {
    ad: { type: String, default: "" }, // address line
    st: { type: String, default: "" }, // state
    city: { type: String, default: "" },
    pin: { type: String, default: "" },
  },
  { _id: false }
);

const partySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    partyName: { type: String, required: true },
    partyType: { type: String, enum: ["CUSTOMER", "SUPPLIER"], default: "CUSTOMER" },
    mobileNo: { type: String, default: "" },
    email: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    panNumber: { type: String, default: "" },

    partyCatagory: { type: String, default: "" },

    openingBalance: { type: Number, default: 0 },
    openingBalanceType: { type: String, default: "TO_COLLECT" }, // TO_COLLECT | TO_PAY
    balance: { type: Number, default: 0 }, // running balance (+ = they owe us)
    creditPeriod: { type: Number, default: 0 },
    creditLimit: { type: Number, default: 0 },

    isSameAddress: { type: Boolean, default: true },
    billingAddressData: { type: addressSchema, default: () => ({}) },
    shippingAddressData: { type: addressSchema, default: () => ({}) },
  },
  { timestamps: true }
);

partySchema.index({ user: 1, createdAt: -1 });
partySchema.index({ user: 1, partyName: 1 });

export type PartyDoc = InferSchemaType<typeof partySchema> & { _id: Types.ObjectId };
export const Party = model("Party", partySchema);
