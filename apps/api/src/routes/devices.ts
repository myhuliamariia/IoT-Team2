import { Router } from "express";
import { listDevices } from "../services/terrarium-service.js";

export const deviceRouter = Router();

deviceRouter.get("/", async (_request, response) => {
  const devices = await listDevices();
  response.json(devices);
});
