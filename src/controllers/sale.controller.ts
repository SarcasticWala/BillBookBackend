import { Request, Response } from "express";
import { Types } from "mongoose";
import * as saleService from "../services/sale.service";
import { ok, created } from "../utils/respond";

const uid = (req: Request) => new Types.ObjectId(req.userId);

export async function createSale(req: Request, res: Response): Promise<void> {
  created(res, await saleService.createSale(uid(req), req.body ?? {}), "Sale invoice created");
}

export async function getSaleInvoices(req: Request, res: Response): Promise<void> {
  ok(res, await saleService.listSaleInvoices(uid(req), req.query));
}
