import { Request, Response } from "express";
import { Types } from "mongoose";
import * as service from "../services/automatedBill.service";
import { ok, created } from "../utils/respond";

const uid = (req: Request) => new Types.ObjectId(req.userId);

export async function createTemplate(req: Request, res: Response): Promise<void> {
  created(res, await service.createTemplate(uid(req), req.body ?? {}), "Template created");
}

export async function listTemplates(req: Request, res: Response): Promise<void> {
  ok(res, await service.listTemplates(uid(req)));
}

export async function getTemplate(req: Request, res: Response): Promise<void> {
  ok(res, await service.getTemplate(uid(req), req.params.id));
}

export async function updateTemplate(req: Request, res: Response): Promise<void> {
  ok(res, await service.updateTemplate(uid(req), req.params.id, req.body ?? {}), "Template updated");
}

export async function pauseTemplate(req: Request, res: Response): Promise<void> {
  ok(res, await service.pauseTemplate(uid(req), req.params.id), "Template paused");
}

export async function resumeTemplate(req: Request, res: Response): Promise<void> {
  ok(res, await service.resumeTemplate(uid(req), req.params.id), "Template resumed");
}

export async function cancelTemplate(req: Request, res: Response): Promise<void> {
  ok(res, await service.cancelTemplate(uid(req), req.params.id), "Template cancelled");
}

export async function listRuns(req: Request, res: Response): Promise<void> {
  ok(res, await service.listRuns(uid(req), req.query.templateId as string | undefined));
}

export async function postRun(req: Request, res: Response): Promise<void> {
  ok(res, await service.postRun(uid(req), req.params.id), "Bill posted");
}

export async function cancelRun(req: Request, res: Response): Promise<void> {
  ok(res, await service.cancelRun(uid(req), req.params.id), "Draft cancelled");
}

export async function retryRun(req: Request, res: Response): Promise<void> {
  ok(res, await service.retryRun(uid(req), req.params.id), "Retried");
}
