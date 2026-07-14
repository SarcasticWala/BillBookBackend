import { Request, Response } from "express";
import { Types } from "mongoose";
import * as itemService from "../services/item.service";
import * as reference from "../services/reference.service";
import { ok, created } from "../utils/respond";
import { ApiError } from "../utils/ApiError";
import { XLSX_CONTENT_TYPE } from "../utils/excel";

const uid = (req: Request) => new Types.ObjectId(req.userId);

function sendErrorWorkbook(res: Response, buffer: Buffer, filename: string): void {
  res
    .status(400)
    .setHeader("Content-Type", XLSX_CONTENT_TYPE)
    .setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
}

export async function createItem(req: Request, res: Response): Promise<void> {
  const files = (req.files as Express.Multer.File[]) ?? [];
  created(res, await itemService.createItem(uid(req), req.body ?? {}, files), "Item created");
}

export async function getItems(req: Request, res: Response): Promise<void> {
  ok(res, await itemService.listItems(uid(req), req.query));
}

export async function getItemById(req: Request, res: Response): Promise<void> {
  const id = req.query.id;
  if (!id) throw new ApiError(400, "id query param is required");
  ok(res, await itemService.getItem(uid(req), String(id)));
}

export async function updateItemStock(req: Request, res: Response): Promise<void> {
  ok(res, await itemService.updateStock(uid(req), req.body), "Stock updated");
}

export async function createItemCategory(req: Request, res: Response): Promise<void> {
  const { name } = req.body ?? {};
  if (!name) throw new ApiError(400, "Category name is required");
  created(res, await itemService.createCategory(uid(req), name), "Category created");
}

export async function getItemCategories(req: Request, res: Response): Promise<void> {
  ok(res, await itemService.listCategories(uid(req)));
}

export async function getTaxes(_req: Request, res: Response): Promise<void> {
  ok(res, await reference.getTaxes());
}

export async function getUnits(_req: Request, res: Response): Promise<void> {
  ok(res, await reference.getUnits());
}

export async function bulkCreateItems(req: Request, res: Response): Promise<void> {
  if (!req.file) throw new ApiError(400, "Excel file is required");
  const result = await itemService.bulkCreate(uid(req), req.file.buffer);
  if (!result.ok) return sendErrorWorkbook(res, result.errorFile, "item-errors.xlsx");
  created(res, { count: result.count }, `${result.count} items created`);
}
