import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { IdempotencyKey } from "../models/IdempotencyKey";

/**
 * Idempotency guard for create endpoints. Opt-in: only engages when the client
 * sends an `Idempotency-Key` header — without it, requests pass straight
 * through (no behaviour change for anything that doesn't send one).
 *
 * Must run AFTER requireAuth (needs req.userId) and AFTER validate (so invalid
 * payloads don't consume a key). Only successful (2xx) responses are stored;
 * failures release the key so a genuine retry can proceed.
 */
export function idempotency(req: Request, res: Response, next: NextFunction): void {
  const key = req.header("Idempotency-Key");
  if (!key || !req.userId) return next();

  const user = new Types.ObjectId(req.userId);

  (async () => {
    let recordId: Types.ObjectId;
    try {
      const created = await IdempotencyKey.create({
        user,
        key,
        method: req.method,
        path: req.originalUrl,
        status: "pending",
      });
      recordId = created._id;
    } catch (err: any) {
      // Duplicate (user, key) → someone already used this key.
      if (err?.code === 11000) {
        const existing = await IdempotencyKey.findOne({ user, key }).lean();
        if (existing?.status === "done") {
          res.status(existing.statusCode || 200).json(existing.response);
          return;
        }
        res
          .status(409)
          .json({ message: "A request with this key is already being processed" });
        return;
      }
      return next(err);
    }

    // Capture the response so a later retry can replay it.
    const originalJson = res.json.bind(res);
    res.json = (body: any): Response => {
      const sc = res.statusCode;
      if (sc >= 200 && sc < 300) {
        void IdempotencyKey.updateOne(
          { _id: recordId },
          { status: "done", statusCode: sc, response: body }
        ).catch(() => {});
      } else {
        // Release the key on failure so the client can retry cleanly.
        void IdempotencyKey.deleteOne({ _id: recordId }).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  })().catch(next);
}
