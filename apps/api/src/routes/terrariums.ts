import { historyRangeSchema, terrariumCreateSchema, terrariumUpdateSchema } from "@biot/shared";
import { Router } from "express";
import {
  createTerrarium,
  getTerrariumDetail,
  listTerrariums,
  updateTerrarium
} from "../services/terrarium-service.js";

export const terrariumRouter = Router();

terrariumRouter.get("/", async (_request, response) => {
  const terrariums = await listTerrariums();
  response.json(terrariums);
});

terrariumRouter.post("/", async (request, response) => {
  const payload = terrariumCreateSchema.parse(request.body);
  const terrarium = await createTerrarium(payload);
  response.status(201).json(terrarium);
});

terrariumRouter.get("/:id", async (request, response) => {
  const query = historyRangeSchema.parse(request.query);
  const terrarium = await getTerrariumDetail(request.params.id, query.hours);
  response.json(terrarium);
});

terrariumRouter.patch("/:id", async (request, response) => {
  const payload = terrariumUpdateSchema.parse(request.body);
  const terrarium = await updateTerrarium(request.params.id, payload);
  response.json(terrarium);
});
