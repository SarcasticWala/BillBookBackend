import { Request, Response } from "express";
import { Types } from "mongoose";
import * as dashboardService from "../services/dashboard.service";
import { ok } from "../utils/respond";

const uid = (req: Request) => new Types.ObjectId(req.userId);

export async function getSummary(req: Request, res: Response): Promise<void> {
  ok(res, await dashboardService.getSummary(uid(req)));
}
