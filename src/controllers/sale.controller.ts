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

export async function getSaleInvoicesPaged(req: Request, res: Response): Promise<void> {
  ok(res, await saleService.listSaleInvoicesPaged(uid(req), req.query));
}

export async function getSaleInvoice(req: Request, res: Response): Promise<void> {
  ok(res, await saleService.getSaleInvoice(uid(req), req.params.id));
}

export async function updateSale(req: Request, res: Response): Promise<void> {
  ok(
    res,
    await saleService.updateSale(uid(req), req.params.id, req.body ?? {}),
    "Sale invoice updated"
  );
}

export async function deleteSale(req: Request, res: Response): Promise<void> {
  ok(res, await saleService.deleteSale(uid(req), req.params.id), "Sale invoice deleted");
}
