import { Response } from "express";

/**
 * Standard success envelope. The frontend consistently reads `response.data`,
 * so every successful response is `{ data, message? }`.
 */
export function ok(res: Response, data: unknown, message?: string): void {
  res.status(200).json({ data, message });
}

export function created(res: Response, data: unknown, message?: string): void {
  res.status(201).json({ data, message });
}
