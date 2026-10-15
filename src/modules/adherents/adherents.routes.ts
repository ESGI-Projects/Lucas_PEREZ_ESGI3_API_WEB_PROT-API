import { Router } from "express";
import { parse, parseId } from "../../http/validation.js";
import { offsetResult } from "../../http/pagination.js";
import {
  adherentInput,
  adherentPatch,
  adherentsQuery,
} from "./adherents.schemas.js";
import type { AdherentsService } from "./adherents.service.js";

export function adherentsRoutes(service: AdherentsService) {
  const router = Router();
  router.get("/", async (req, res) => {
    const query = parse(adherentsQuery, req.query, 400);
    const result = await service.list(query);
    res.json(offsetResult(req, result.data, result.total, query));
  });
  router.get("/:id", async (req, res) => {
    res.json(await service.get(parseId(req.params.id)));
  });
  router.post("/", async (req, res) => {
    const row = await service.create(parse(adherentInput, req.body));
    res.location(`/adherents/${row.id}`).status(201).json(row);
  });
  router.put("/:id", async (req, res) => {
    res.json(
      await service.update(
        parseId(req.params.id),
        parse(adherentInput, req.body),
      ),
    );
  });
  router.patch("/:id", async (req, res) => {
    res.json(
      await service.update(
        parseId(req.params.id),
        parse(adherentPatch, req.body),
      ),
    );
  });
  router.delete("/:id", async (req, res) => {
    await service.remove(parseId(req.params.id));
    res.status(204).end();
  });
  return router;
}

export function abonnementsRoutes(service: AdherentsService) {
  const router = Router();
  router.get("/", async (req, res) => {
    const query = parse(adherentsQuery, req.query, 400),
      result = await service.subscriptions(query);
    res.json(offsetResult(req, result.data, result.total, query));
  });
  return router;
}
