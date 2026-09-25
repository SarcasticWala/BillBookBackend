import { Request, Response } from "express";
import { Types } from "mongoose";
import * as reportService from "../services/report.service";
import { ok } from "../utils/respond";

const uid = (req: Request) => new Types.ObjectId(req.userId);

export async function getSalesSummary(req: Request, res: Response): Promise<void> {
  ok(res, await reportService.salesSummary(uid(req), req.query.from, req.query.to));
}

export async function getPurchaseSummary(req: Request, res: Response): Promise<void> {
  ok(res, await reportService.purchaseSummary(uid(req), req.query.from, req.query.to));
}

export async function getDaybook(req: Request, res: Response): Promise<void> {
  ok(res, await reportService.daybook(uid(req), req.query.from, req.query.to));
}

export async function getPartyOutstanding(req: Request, res: Response): Promise<void> {
  ok(res, await reportService.partyOutstanding(uid(req)));
}

export async function getPartyLedger(req: Request, res: Response): Promise<void> {
  ok(
    res,
    await reportService.partyLedger(uid(req), req.params.partyId, req.query.from, req.query.to)
  );
}

export async function getStockSummary(req: Request, res: Response): Promise<void> {
  ok(res, await reportService.stockSummary(uid(req), req.query.lowStockOnly));
}

export async function getReceivablesAging(req: Request, res: Response): Promise<void> {
  ok(res, await reportService.receivablesAging(uid(req), req.query.asOf));
}
