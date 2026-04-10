import { telemetryBatchSchema } from "@biot/shared";
import { Router } from "express";
import { ingestTelemetryBatch } from "../services/ingest-service.js";
import { getBearerToken } from "../utils/auth.js";
import { HttpError } from "../utils/http-error.js";

export const ingestRouter = Router();

ingestRouter.post("/telemetry", async (request, response) => {
  const apiKey = getBearerToken(request.header("authorization"));
  if (!apiKey) {
    throw new HttpError(401, "gateway.auth.missing", "A Bearer token is required for ingest.");
  }

  const payload = telemetryBatchSchema.parse(request.body);
  const result = await ingestTelemetryBatch(payload, apiKey, {
    sourceIp: request.ip,
    requestId: request.headers["x-request-id"]?.toString()
  });

  response.status(202).json(result);
});
