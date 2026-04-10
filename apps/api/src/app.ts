import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import type { AppEnv } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { deviceRouter } from "./routes/devices.js";
import { createGatewayRouter } from "./routes/gateways.js";
import { healthRouter } from "./routes/health.js";
import { ingestRouter } from "./routes/ingest.js";
import { overviewRouter } from "./routes/overview.js";
import { terrariumRouter } from "./routes/terrariums.js";

export function createApp(env: AppEnv) {
  const logger = pino({
    level: env.NODE_ENV === "development" ? "debug" : "info"
  });

  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((value) => value.trim())
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(
    (request, response, next) => {
      const startedAt = Date.now();
      response.on("finish", () => {
        logger.info(
          {
            method: request.method,
            path: request.originalUrl,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt
          },
          "request completed"
        );
      });

      next();
    }
  );

  app.use("/api", healthRouter);
  app.use("/api/v1/gateways", createGatewayRouter(env));
  app.use("/api/v1/devices", deviceRouter);
  app.use("/api/v1/terrariums", terrariumRouter);
  app.use("/api/v1/overview", overviewRouter);
  app.use("/api/v1/ingest", ingestRouter);

  const webDistDir = path.resolve(env.WEB_DIST_DIR);
  if (fs.existsSync(webDistDir)) {
    app.use(express.static(webDistDir));
    app.get(/^\/(?!api).*/, (_request, response) => {
      response.sendFile(path.join(webDistDir, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
