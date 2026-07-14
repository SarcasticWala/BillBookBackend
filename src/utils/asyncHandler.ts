import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async route handler so thrown/rejected errors reach the
 * Express error middleware instead of crashing the process.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
