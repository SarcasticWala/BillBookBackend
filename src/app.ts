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
import accountRoutes from "./routes/account.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import expenseRoutes from "./routes/expense.routes";
import posRoutes from "./routes/pos.routes";
import automatedBillRoutes from "./routes/automatedBill.routes";
import eInvoiceRoutes from "./routes/eInvoice.routes";
import { requireFeature } from "./middleware/featureFlag";
import { notFound, errorHandler } from "./middleware/error";
import { mountDocs } from "./docs/swagger";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Render sits behind a proxy; needed for rate-limit IPs

  app.use(helmet());
  app.use(compression());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/health" },
      // Default pino-http serializers dump every request/response header,
      // which drowns out the one line per request that's actually useful
      // day-to-day. Keep just method/url/statusCode.
      serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    })
  );

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

  // Interactive API docs (development only — no-op in production). Mounted
  // before the rate limiter so browsing the docs is never throttled.
  mountDocs(app);

  app.use("/api", apiLimiter);
  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/item", itemRoutes);
  app.use("/api/party", partyRoutes);
  app.use("/api/sale", saleRoutes);
  app.use("/api/purchase", purchaseRoutes);
  app.use("/api/document", documentRoutes);
  app.use("/api/payment", paymentRoutes);
  app.use("/api/demo", demoRoutes);
  app.use("/api/account", accountRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/expense", expenseRoutes);
  app.use("/api/pos", requireFeature("posBilling"), posRoutes);
  app.use(
    "/api/automated-bills",
    requireFeature("automatedBills"),
    automatedBillRoutes
  );
  app.use("/api/e-invoice", requireFeature("eInvoicing"), eInvoiceRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
