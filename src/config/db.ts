import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB(): Promise<void> {
  mongoose.set("strictQuery", true);
  // Cap the pool so a free-tier (M0) Atlas cluster stays well under its
  // connection limit even across restarts / multiple instances.
  await mongoose.connect(env.mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 15000,
  });
  console.log("[db] MongoDB connected");

  mongoose.connection.on("error", (err) => {
    console.error("[db] connection error:", err);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[db] disconnected");
  });
}
