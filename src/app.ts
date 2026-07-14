import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { apiLimiter, authLimiter } from "./middleware/rateLimit";
import authRoutes from "./routes/auth.routes";
import itemRoutes from "./routes/item.routes";
import partyRoutes from "./routes/party.routes";
import saleRoutes from "./routes/sale.routes";
import purchaseRoutes from "./routes/purchase.routes";
import documentRoutes from "./routes/document.routes";
import paymentRoutes from "./routes/payment.routes";
import demoRoutes from "./routes/demo.routes";
import { notFound, errorHandler } from "./middleware/error";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Render sits behind a proxy; needed for rate-limit IPs

  app.use(helmet());
  app.use(compression());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow non-browser tools (no origin) and any whitelisted origin.
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.use("/api", apiLimiter);
  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/item", itemRoutes);
  app.use("/api/party", partyRoutes);
  app.use("/api/sale", saleRoutes);
  app.use("/api/purchase", purchaseRoutes);
  app.use("/api/document", documentRoutes);
  app.use("/api/payment", paymentRoutes);
  app.use("/api/demo", demoRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
