import { Router } from "express";
import { parse, parseId } from "../../http/validation.js";
import { offsetResult } from "../../http/pagination.js";
import { courseEtag, matchesRead } from "../../http/etag.js";
import { coursInput, coursPatch, coursQuery } from "./cours.schemas.js";
import type { CoursService } from "./cours.service.js";
export function coursRoutes(service: CoursService) {
  const router = Router();
  router.get("/", async (req, res) => {
    const query = parse(coursQuery, req.query, 400),
      result = await service.list(query);
    res.json(offsetResult(req, result.data, result.total, query));
  });
  router.get("/:id", async (req, res) => {
    const row = await service.get(parseId(req.params.id)),
      tag = courseEtag(row);
    res.set("ETag", tag).set("Cache-Control", "private, no-cache");
    if (matchesRead(req.get("If-None-Match"), tag)) {
      res.status(304).end();
      return;
    }
    res.json(row);
  });
  router.post("/", async (req, res) => {
    const row = await service.create(parse(coursInput, req.body));
    res
      .location(`/cours/${row.id}`)
      .set("ETag", courseEtag(row))
      .status(201)
      .json(row);
  });
  router.put("/:id", async (req, res) => {
    const row = await service.update(
      parseId(req.params.id),
      parse(coursInput, req.body),
      req.get("If-Match"),
    );
    res.set("ETag", courseEtag(row)).json(row);
  });
  router.patch("/:id", async (req, res) => {
    const row = await service.update(
      parseId(req.params.id),
      parse(coursPatch, req.body),
      req.get("If-Match"),
    );
    res.set("ETag", courseEtag(row)).json(row);
  });
  router.delete("/:id", async (req, res) => {
    await service.remove(parseId(req.params.id), req.get("If-Match"));
    res.status(204).end();
  });
  return router;
}

export function coachsRoutes(service: CoursService) {
  const router = Router();
  router.get("/", async (req, res) => {
    const query = parse(coursQuery, req.query, 400),
      result = await service.coaches(query);
    res.json(offsetResult(req, result.data, result.total, query));
  });
  return router;
}
