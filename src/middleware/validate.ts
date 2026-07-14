import { Request, Response, NextFunction } from "express";
import { ZodTypeAny } from "zod";
import { ApiError } from "../utils/ApiError";

type Source = "body" | "query" | "params";

/**
 * Validate a request segment against a Zod schema BEFORE any DB work, so bad
 * input is rejected without a wasted round-trip. On success the parsed value
 * replaces the raw segment (coerced/defaulted).
 */
export function validate(schema: ZodTypeAny, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      throw new ApiError(400, "Validation failed", details);
    }
    // query/params are read-only getters in Express 5-style; assign safely.
    (req as any)[source] = result.data;
    next();
  };
}
