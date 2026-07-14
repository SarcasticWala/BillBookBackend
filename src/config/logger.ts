import pino from "pino";
import { isProd } from "./env";

// Structured logging. Pretty-printed in dev, JSON (Render-friendly) in prod.
export const logger = pino(
  isProd
    ? { level: process.env.LOG_LEVEL || "info" }
    : {
        level: process.env.LOG_LEVEL || "debug",
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
        },
      }
);
