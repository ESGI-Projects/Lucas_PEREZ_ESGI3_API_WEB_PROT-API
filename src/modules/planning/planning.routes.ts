import { Router } from "express";
import { parse, parseId } from "../../http/validation.js";
import { offsetResult } from "../../http/pagination.js";
import { planningQuery, creneauInput } from "./planning.schemas.js";
import type { PlanningService } from "./planning.service.js";
export function planningRoutes(service: PlanningService) {
  const router = Router();
  router.get("/creneaux", async (req, res) => {
    const query = parse(planningQuery, req.query, 400),
      result = await service.list(query);
    res.json(offsetResult(req, result.data, result.total, query));
  });
  router.get("/cours/:id/creneaux", async (req, res) => {
    const query = parse(planningQuery, req.query, 400),
      result = await service.listForCourse(parseId(req.params.id), query);
    res.json(offsetResult(req, result.data, result.total, query));
  });
  router.get("/creneaux/:id", async (req, res) => {
    res.json(await service.get(parseId(req.params.id)));
  });
  router.post("/cours/:id/creneaux", async (req, res) => {
    const row = await service.create(
      parseId(req.params.id),
      parse(creneauInput, req.body),
    );
    res.location(`/creneaux/${row.id}`).status(201).json(row);
  });
  return router;
}
