import { Router } from "express";
import { getOverview } from "../services/terrarium-service.js";

export const overviewRouter = Router();

overviewRouter.get("/", async (_request, response) => {
  const overview = await getOverview();
  response.json(overview);
});
