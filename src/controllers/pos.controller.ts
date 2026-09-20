import { Request, Response } from "express";
import { Types } from "mongoose";
import * as posService from "../services/pos.service";
import { created } from "../utils/respond";

const uid = (req: Request) => new Types.ObjectId(req.userId);

export async function checkoutPos(req: Request, res: Response): Promise<void> {
  created(res, await posService.checkoutPos(uid(req), req.body ?? {}), "Sale completed");
}
