import { Request, Response } from "express";
import { Types } from "mongoose";
import * as paymentService from "../services/payment.service";
import { ok, created } from "../utils/respond";
import { ApiError } from "../utils/ApiError";

const uid = (req: Request) => new Types.ObjectId(req.userId);

export async function create(req: Request, res: Response): Promise<void> {
  const type = String(req.body?.type ?? "");
  created(res, await paymentService.createPayment(uid(req), type, req.body ?? {}), "Payment recorded");
}

export async function list(req: Request, res: Response): Promise<void> {
  const type = String(req.query.type ?? "");
  if (!type) throw new ApiError(400, "type query param is required");
  ok(res, await paymentService.listPayments(uid(req), type, req.query));
}
