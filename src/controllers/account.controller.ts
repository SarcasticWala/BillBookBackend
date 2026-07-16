import { Request, Response } from "express";
import { Types } from "mongoose";
import * as accountService from "../services/account.service";
import { ok, created } from "../utils/respond";

const uid = (req: Request) => new Types.ObjectId(req.userId);

export async function getAccounts(req: Request, res: Response): Promise<void> {
  ok(res, await accountService.listAccounts(uid(req)));
}

export async function createAccount(req: Request, res: Response): Promise<void> {
  created(res, await accountService.createAccount(uid(req), req.body ?? {}), "Account created");
}

export async function adjustMoney(req: Request, res: Response): Promise<void> {
  ok(
    res,
    await accountService.adjustMoney(uid(req), req.params.id, req.body ?? {}),
    "Money updated"
  );
}

export async function transferMoney(req: Request, res: Response): Promise<void> {
  ok(res, await accountService.transferMoney(uid(req), req.body ?? {}), "Money transferred");
}

export async function getTransactions(req: Request, res: Response): Promise<void> {
  ok(res, await accountService.listTransactions(uid(req), req.query));
}

export async function deleteAccount(req: Request, res: Response): Promise<void> {
  ok(res, await accountService.deleteAccount(uid(req), req.params.id), "Account deleted");
}
