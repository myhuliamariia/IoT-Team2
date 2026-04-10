import { gatewayRegistrationRequestSchema } from "@biot/shared";
import { Router } from "express";
import type { AppEnv } from "../config/env.js";
import { listGateways, registerGateway } from "../services/gateway-service.js";

export function createGatewayRouter(env: AppEnv): Router {
  const router = Router();

  router.post("/register", async (request, response) => {
    const payload = gatewayRegistrationRequestSchema.parse(request.body);
    const result = await registerGateway(payload, env);
    response.status(201).json(result);
  });

  router.get("/", async (_request, response) => {
    const gateways = await listGateways();
    response.json(gateways);
  });

  return router;
}
