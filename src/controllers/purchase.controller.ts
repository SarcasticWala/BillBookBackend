import { Request, Response } from "express";
import { Types } from "mongoose";
import * as purchaseService from "../services/purchase.service";
import { ok, created } from "../utils/respond";

const uid = (req: Request) => new Types.ObjectId(req.userId);

export async function createPurchase(req: Request, res: Response): Promise<void> {
  created(
    res,
    await purchaseService.createPurchase(uid(req), req.body ?? {}),
    "Purchase invoice created"
  );
}

export async function getPurchaseInvoices(req: Request, res: Response): Promise<void> {
  ok(res, await purchaseService.listPurchaseInvoices(uid(req), req.query));
}

export async function getPurchaseInvoicesPaged(req: Request, res: Response): Promise<void> {
  ok(res, await purchaseService.listPurchaseInvoicesPaged(uid(req), req.query));
}

export async function getPurchaseInvoice(req: Request, res: Response): Promise<void> {
  ok(res, await purchaseService.getPurchaseInvoice(uid(req), req.params.id));
}

export async function updatePurchase(req: Request, res: Response): Promise<void> {
  ok(
    res,
    await purchaseService.updatePurchase(uid(req), req.params.id, req.body ?? {}),
    "Purchase invoice updated"
  );
}

export async function deletePurchase(req: Request, res: Response): Promise<void> {
  ok(
    res,
    await purchaseService.deletePurchase(uid(req), req.params.id),
    "Purchase invoice deleted"
  );
}
