import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { ok } from "../utils/respond";
import { ApiError } from "../utils/ApiError";

import * as otpService from "../services/otp.service";

export async function sendOtp(req: Request, res: Response): Promise<void> {
  const result = await otpService.requestOtp(req.body?.email);
  // devCode is present only in non-production when SMTP isn't configured, so
  // the flow stays testable without an email provider.
  res.json({ message: "Verification code sent", ...result });
}

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body);
  res.status(201).json({ token: result.token, data: result.user });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body);
  res.json({ token: result.token, data: result.user });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const result = await authService.resetPassword(req.body);
  res.json({ token: result.token, data: result.user });
}

export async function me(req: Request, res: Response): Promise<void> {
  ok(res, await authService.getProfile(req.userId!));
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const body: Record<string, unknown> = { ...(req.body ?? {}) };
  // Optional business logo (multipart field "logo"). Stored inline as a data
  // URI on the user record — no external image service required.
  if (req.file) {
    if (req.file.size > 2 * 1024 * 1024) {
      throw new ApiError(400, "Logo image must be under 2MB");
    }
    body.logoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString(
      "base64"
    )}`;
  }
  ok(res, await authService.updateProfile(req.userId!, body));
}
