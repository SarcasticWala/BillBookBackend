import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";

// Augment Express Request with the authenticated user id.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      phone?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, "Authentication required");
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.phone = payload.phone;
    next();
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
}

/** Allow only admins (phone in ADMIN_PHONES). Must run after requireAuth. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.phone || !env.adminPhones.includes(req.phone)) {
    throw new ApiError(403, "Admin access required");
  }
  next();
}

export function isAdminPhone(phone?: string): boolean {
  return !!phone && env.adminPhones.includes(phone);
}
