import { Request, Response } from "express";
import { Types } from "mongoose";
import * as partyService from "../services/party.service";
import * as reference from "../services/reference.service";
import { ok, created } from "../utils/respond";
import { ApiError } from "../utils/ApiError";
import { XLSX_CONTENT_TYPE } from "../utils/excel";

const uid = (req: Request) => new Types.ObjectId(req.userId);

export async function createParty(req: Request, res: Response): Promise<void> {
  created(res, await partyService.createParty(uid(req), req.body ?? {}), "Party created");
}

export async function getParties(req: Request, res: Response): Promise<void> {
  ok(res, await partyService.listParties(uid(req), req.query));
}

export async function getPartyById(req: Request, res: Response): Promise<void> {
  ok(res, await partyService.getParty(uid(req), req.params.id));
}

export async function updateParty(req: Request, res: Response): Promise<void> {
  ok(res, await partyService.updateParty(uid(req), req.params.id, req.body ?? {}), "Party updated");
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  const { name } = req.body ?? {};
  if (!name) throw new ApiError(400, "Category name is required");
  created(res, await partyService.createCategory(uid(req), name), "Category created");
}

export async function getCategories(req: Request, res: Response): Promise<void> {
  ok(res, await partyService.listCategories(uid(req)));
}

export async function getLocations(_req: Request, res: Response): Promise<void> {
  ok(res, await reference.getLocations());
}

export async function bulkCreateParties(req: Request, res: Response): Promise<void> {
  if (!req.file) throw new ApiError(400, "Excel file is required");
  const result = await partyService.bulkCreate(uid(req), req.file.buffer);
  if (!result.ok) {
    res
      .status(400)
      .setHeader("Content-Type", XLSX_CONTENT_TYPE)
      .setHeader("Content-Disposition", 'attachment; filename="party-errors.xlsx"');
    res.send(result.errorFile);
    return;
  }
  created(res, { count: result.count }, `${result.count} parties created`);
}
