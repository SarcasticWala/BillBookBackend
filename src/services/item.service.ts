import { Types } from "mongoose";
import { Item, ItemDoc } from "../models/Item";
// Categories are unified across Parties and Items — both use one shared store
// (the party-category collection) so a category created in either place shows
// in both. Parties reference categories by id, so this collection stays canonical.
import { PartyCategory } from "../models/PartyCategory";
import { ApiError } from "../utils/ApiError";
import { uploadBuffer } from "../config/cloudinary";
import { parseSheet, buildErrorWorkbook } from "../utils/excel";
import { getPaging } from "../utils/pagination";
import { logger } from "../config/logger";

// Upload each image to Cloudinary; if that's unavailable/misconfigured, fall
// back to an inline data URI (small images only) so item creation never fails
// on image upload. Oversized images are skipped rather than blocking the save.
const INLINE_IMAGE_MAX = 2 * 1024 * 1024; // 2 MB
async function storeImages(files: Express.Multer.File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files ?? []) {
    try {
      urls.push(await uploadBuffer(file.buffer));
    } catch (err) {
      if (file.size <= INLINE_IMAGE_MAX) {
        urls.push(`data:${file.mimetype};base64,${file.buffer.toString("base64")}`);
      } else {
        logger.warn(
          { name: file.originalname, size: file.size },
          "Image upload failed and file too large to inline — skipped"
        );
      }
    }
  }
  return urls;
}

const bool = (v: unknown): boolean => v === true || v === "true";
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Gather itemSerialNos[], itemSerialNos[0].. from a multipart body into a list. */
function gatherSerials(body: Record<string, any>): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (!key.startsWith("itemSerialNos")) continue;
    if (Array.isArray(value)) out.push(...value.map(String));
    else if (value != null && String(value).trim()) out.push(String(value));
  }
  return out.filter(Boolean);
}

/** Map a stored item to the shape the frontend reads. */
export function toItemResponse(doc: ItemDoc & { _id: Types.ObjectId }) {
  const isProduct = doc.itemType === "PRODUCT";
  return {
    id: String(doc._id),
    _id: String(doc._id),
    itemType: doc.itemType,
    itemName: isProduct ? doc.name : undefined,
    serviceName: isProduct ? undefined : doc.name,
    name: doc.name,
    salePrice: doc.salePrice,
    purchasePrice: doc.purchasePrice,
    gstRate: { value: doc.gstRate, label: `GST @ ${doc.gstRate}%` },
    unit: doc.unit,
    category: doc.categoryName,
    code: doc.itemCode,
    itemCode: doc.itemCode,
    hsnCode: doc.hsnCode,
    sacCode: doc.sacCode,
    serviceCode: doc.serviceCode,
    netQuantity: doc.stock,
    stock: doc.stock,
    openingStock: doc.openingStock,
    isSaleTaxApplicable: doc.isSaleTaxApplicable,
    isPurchaseTaxApplicable: doc.isPurchaseTaxApplicable,
    isPreowned: doc.isPreowned,
    itemProductType: doc.itemProductType,
    isOnlineVisible: doc.isOnlineVisible,
    hasSerialization: doc.hasSerialization,
    serialNos: doc.serialNos,
    productAlertValue: doc.productAlertValue,
    isAlertEnabled: doc.isAlertEnabled,
    asOfDate: doc.asOfDate,
    description: doc.description,
    images: doc.images,
    imageUrl: doc.imageUrl,
    createdAt: (doc as any).createdAt,
    updatedAt: (doc as any).updatedAt,
  };
}

// The item-create form sends the category id; store the category NAME so it
// displays and filters consistently (falls back to the raw value if it's
// already a name or an unknown id).
async function resolveCategoryName(userId: Types.ObjectId, val: any): Promise<string> {
  const raw = String(val ?? "").trim();
  if (!raw) return "";
  if (Types.ObjectId.isValid(raw)) {
    const cat = await PartyCategory.findOne({ _id: raw, user: userId }).lean();
    if (cat) return cat.name;
  }
  return raw;
}

export async function createItem(
  userId: Types.ObjectId,
  body: Record<string, any>,
  files: Express.Multer.File[]
) {
  if (!body.itemName) throw new ApiError(400, "Item name is required");

  const images: string[] = await storeImages(files);

  const itemType = String(body.itemType || "PRODUCT").toUpperCase();
  const opening = num(body.openingStock);

  const item = await Item.create({
    user: userId,
    itemType,
    name: body.itemName,
    isOnlineVisible: bool(body.isOnlineVisible),
    itemProductType: body.itemProductType || "NEW",
    isPreowned: String(body.itemProductType || "NEW").toUpperCase() !== "NEW",
    categoryName: await resolveCategoryName(userId, body.itemCatagory),
    salePrice: num(body.salePrice),
    purchasePrice: num(body.purchasePrice),
    gstRate: num(body.gstRate),
    isSaleTaxApplicable: bool(body.isSaleTaxApplicable),
    isPurchaseTaxApplicable: bool(body.isPurchaseTaxApplicable),
    unit: body.unit || "PCS",
    itemCode: body.itemCode || "",
    hsnCode: body.hsnCode || "",
    sacCode: body.sacCode || "",
    serviceCode: body.serviceCode || "",
    openingStock: opening,
    stock: opening,
    productAlertValue: num(body.productAlertValue),
    isAlertEnabled: bool(body.isAlertEnabled),
    asOfDate: body.asOfDate ? new Date(body.asOfDate) : null,
    hasSerialization: bool(body.hasSerialisationOn),
    serialNos: gatherSerials(body),
    batteryPercentage: body.batteryPercentage || "",
    description: body.description || "",
    images,
    imageUrl: images[0] || "",
  });

  return toItemResponse(item as any);
}

export async function updateItem(
  userId: Types.ObjectId,
  id: string,
  body: Record<string, any>,
  files: Express.Multer.File[]
) {
  const item = await Item.findOne({ _id: id, user: userId });
  if (!item) throw new ApiError(404, "Item not found");
  if (!body.itemName) throw new ApiError(400, "Item name is required");

  const itemType = String(body.itemType || item.itemType || "PRODUCT").toUpperCase();

  // Keep the images already on the item; append any newly uploaded ones.
  const newImages: string[] = await storeImages(files);
  const images = [...(item.images || []), ...newImages];

  item.set({
    itemType,
    name: body.itemName,
    isOnlineVisible: bool(body.isOnlineVisible),
    itemProductType: body.itemProductType || "NEW",
    isPreowned: String(body.itemProductType || "NEW").toUpperCase() !== "NEW",
    categoryName: await resolveCategoryName(userId, body.itemCatagory),
    salePrice: num(body.salePrice),
    purchasePrice: num(body.purchasePrice),
    gstRate: num(body.gstRate),
    isSaleTaxApplicable: bool(body.isSaleTaxApplicable),
    isPurchaseTaxApplicable: bool(body.isPurchaseTaxApplicable),
    unit: body.unit || "PCS",
    itemCode: body.itemCode || "",
    hsnCode: body.hsnCode || "",
    sacCode: body.sacCode || "",
    serviceCode: body.serviceCode || "",
    productAlertValue: num(body.productAlertValue),
    isAlertEnabled: bool(body.isAlertEnabled),
    asOfDate: body.asOfDate ? new Date(body.asOfDate) : item.asOfDate,
    hasSerialization: bool(body.hasSerialisationOn),
    serialNos: gatherSerials(body),
    batteryPercentage: body.batteryPercentage || "",
    description: body.description || "",
    images,
    imageUrl: images[0] || "",
  });

  // If opening stock changed, shift on-hand stock by the same delta so the
  // running quantity stays consistent with movements already recorded.
  if (body.openingStock != null && body.openingStock !== "") {
    const newOpening = num(body.openingStock);
    const delta = newOpening - num(item.openingStock);
    item.openingStock = newOpening;
    item.stock = num(item.stock) + delta;
  }

  await item.save();
  return toItemResponse(item as any);
}

export async function listItems(userId: Types.ObjectId, query: Record<string, any>) {
  const { limit, skip } = getPaging(query);
  const docs = await Item.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean<Array<ItemDoc & { _id: Types.ObjectId }>>()
    .exec();
  return docs.map((d) => toItemResponse(d));
}

export async function getItem(userId: Types.ObjectId, id: string) {
  const doc = await Item.findOne({ _id: id, user: userId }).lean<
    ItemDoc & { _id: Types.ObjectId }
  >();
  if (!doc) throw new ApiError(404, "Item not found");
  return toItemResponse(doc as any);
}

export async function updateStock(
  userId: Types.ObjectId,
  body: { id: string; stock?: number; adjustment?: number }
) {
  const item = await Item.findOne({ _id: body.id, user: userId });
  if (!item) throw new ApiError(404, "Item not found");

  if (typeof body.stock === "number") item.stock = body.stock;
  else if (typeof body.adjustment === "number") item.stock += body.adjustment;
  else throw new ApiError(400, "Provide 'stock' or 'adjustment' as a number");

  await item.save();
  return toItemResponse(item as any);
}

export async function createCategory(userId: Types.ObjectId, name: string) {
  const trimmed = String(name).trim();
  // Shared collection with a unique (user, name) index — reuse if it already
  // exists (created from either Parties or Items) instead of erroring.
  let cat = await PartyCategory.findOne({ user: userId, name: trimmed });
  if (!cat) {
    try {
      cat = await PartyCategory.create({ user: userId, name: trimmed });
    } catch (err: any) {
      if (err?.code === 11000) cat = await PartyCategory.findOne({ user: userId, name: trimmed });
      else throw err;
    }
  }
  return { id: String(cat!._id), _id: String(cat!._id), name: cat!.name, value: String(cat!._id), label: cat!.name };
}

export async function listCategories(userId: Types.ObjectId) {
  const cats = await PartyCategory.find({ user: userId }).sort({ name: 1 }).lean();
  return cats.map((c) => ({
    id: String(c._id),
    _id: String(c._id),
    name: c.name,
    value: String(c._id),
    label: c.name,
  }));
}

export async function bulkCreate(
  userId: Types.ObjectId,
  fileBuffer: Buffer
): Promise<{ ok: true; count: number } | { ok: false; errorFile: Buffer }> {
  const rows = parseSheet<Record<string, any>>(fileBuffer);
  if (!rows.length) throw new ApiError(400, "Excel file has no rows");

  const valid: any[] = [];
  const errors: Array<Record<string, any> & { Error: string }> = [];

  for (const row of rows) {
    const name = String(row.Name ?? row.name ?? "").trim();
    if (!name) {
      errors.push({ ...row, Error: "Name is required" });
      continue;
    }
    const salePrice = Number(row.SalePrice ?? row.salePrice ?? 0);
    if (Number.isNaN(salePrice)) {
      errors.push({ ...row, Error: "SalePrice must be a number" });
      continue;
    }
    const opening = num(row.OpeningStock ?? row.openingStock);
    valid.push({
      user: userId,
      itemType: String(row.ItemType ?? row.itemType ?? "PRODUCT").toUpperCase(),
      name,
      hsnCode: String(row.HSN ?? row.hsnCode ?? ""),
      unit: String(row.Unit ?? row.unit ?? "PCS"),
      salePrice,
      purchasePrice: num(row.PurchasePrice ?? row.purchasePrice),
      gstRate: num(row.TaxRate ?? row.gstRate),
      openingStock: opening,
      stock: opening,
    });
  }

  if (errors.length) return { ok: false, errorFile: buildErrorWorkbook(errors) };

  const created = await Item.insertMany(valid);
  return { ok: true, count: created.length };
}
