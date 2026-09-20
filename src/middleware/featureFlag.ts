import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

/**
 * Gates an entire router behind an env.flags entry. When off, the route
 * behaves as if it doesn't exist (404) rather than a visible "disabled"
 * response — a dark-shipped module leaves no trace in the API surface.
 */
export function requireFeature(flag: keyof typeof env.flags) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    if (!env.flags[flag]) throw new ApiError(404, "Not found");
    next();
  };
}
