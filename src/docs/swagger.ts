import { Express } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi";
import { isProd } from "../config/env";
import { logger } from "../config/logger";

/**
 * Mounts interactive API docs — but ONLY outside production, so the schema and
 * "try it out" console are never exposed on the live deployment.
 *
 *   GET /api/docs        → Swagger UI (with an Authorize / Bearer-token flow)
 *   GET /api/docs.json   → the raw OpenAPI 3.0 document
 */
export function mountDocs(app: Express): void {
  if (isProd) return;

  app.get("/api/docs.json", (_req, res) => {
    res.json(openApiDocument);
  });

  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "BillBook API docs",
      swaggerOptions: {
        persistAuthorization: true, // keep the pasted token across reloads
        docExpansion: "none",
      },
    })
  );

  logger.info("API docs available at /api/docs (development only)");
}
