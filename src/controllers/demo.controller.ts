import { Request, Response } from "express";
import { Types } from "mongoose";
import * as demoService from "../services/demo.service";
import { ok, created } from "../utils/respond";

const uid = (req: Request) => new Types.ObjectId(req.userId);

export async function bookDemo(req: Request, res: Response): Promise<void> {
  created(res, await demoService.bookDemo(uid(req), req.body ?? {}), "Demo booked");
}

export async function getDemos(req: Request, res: Response): Promise<void> {
  ok(res, await demoService.listDemos(uid(req), req.query));
}

// --- Admin ---

export async function getAllDemos(req: Request, res: Response): Promise<void> {
  ok(res, await demoService.listAllDemos(req.query));
}

export async function updateDemoStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body ?? {};
  ok(res, await demoService.updateStatus(req.params.id, status), "Status updated");
}
