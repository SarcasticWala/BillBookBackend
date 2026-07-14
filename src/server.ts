import { Server } from "http";
import mongoose from "mongoose";
import { createApp } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { logger } from "./config/logger";

let server: Server;

async function start() {
  try {
    await connectDB();
    const app = createApp();
    server = app.listen(env.port, () => {
      logger.info(`Server listening on http://localhost:${env.port} (${env.nodeEnv})`);
    });
  } catch (err) {
    logger.error({ err }, "Server failed to start");
    process.exit(1);
  }
}

// Graceful shutdown — matters on Render, which restarts/redeploys often.
async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  server?.close(async () => {
    await mongoose.connection.close();
    logger.info("HTTP server + MongoDB connection closed");
    process.exit(0);
  });
  // Force-exit if cleanup hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

start();
