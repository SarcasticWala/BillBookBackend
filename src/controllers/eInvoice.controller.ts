import { Request, Response } from "express";
import { Types } from "mongoose";
import * as service from "../services/eInvoice.service";
import { ok } from "../utils/respond";

const uid = (req: Request) => new Types.ObjectId(req.userId);

export async function setEnabled(req: Request, res: Response): Promise<void> {
  ok(res, await service.setEInvoicingEnabled(uid(req), Boolean(req.body?.enabled)), "Updated");
}

export async function submit(req: Request, res: Response): Promise<void> {
  ok(res, await service.submitForEInvoice(uid(req), req.params.id), "e-Invoice submitted");
}

export async function cancel(req: Request, res: Response): Promise<void> {
  ok(
    res,
    await service.cancelEInvoice(uid(req), req.params.id, req.body?.reason || ""),
    "e-Invoice cancelled"
  );
}

export async function gstr1(req: Request, res: Response): Promise<void> {
  ok(res, await service.gstr1Summary(uid(req), String(req.query.month || "")));
}
