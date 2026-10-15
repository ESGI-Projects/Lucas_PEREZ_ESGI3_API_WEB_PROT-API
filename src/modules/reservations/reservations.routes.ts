import { Router } from "express";
import { parse, parseId } from "../../http/validation.js";
import { offsetResult } from "../../http/pagination.js";
import {
  annulationInput,
  attenteQuery,
  historiqueQuery,
  reservationInput,
} from "./reservations.schemas.js";
import type { ReservationsService } from "./reservations.service.js";
export function reservationsRoutes(service: ReservationsService) {
  const router = Router();
  router.post("/creneaux/:id/reservations", async (req, res) => {
    const input = parse(reservationInput, req.body);
    const row = await service.create(parseId(req.params.id), input.adherent_id);
    const collection =
      row.statut === "en_attente" ? "listes_attente" : "reservations";
    res.location(`/${collection}/${row.id}`).status(201).json(row);
  });
  router.get("/reservations", async (req, res) => {
    const query = parse(historiqueQuery, req.query, 400);
    if (query.page !== undefined) {
      const page = { ...query, page: query.page },
        result = await service.offsetHistory(page);
      res.json(offsetResult(req, result.data, result.total, page));
      return;
    }
    const result = await service.history(query);
    let next: string | null = null;
    if (result.after) {
      const url = new URL(req.originalUrl, "http://local");
      url.searchParams.set("after", result.after);
      url.searchParams.set("limit", String(query.limit));
      next = url.pathname + url.search;
    }
    res.json({
      data: result.data,
      pagination: { limit: query.limit },
      links: { next },
    });
  });
  router.get("/reservations/:id", async (req, res) => {
    res.json(await service.get(parseId(req.params.id)));
  });
  router.patch("/reservations/:id", async (req, res) => {
    parse(annulationInput, req.body);
    res.json(await service.cancel(parseId(req.params.id)));
  });
  router.get("/listes_attente", async (req, res) => {
    const query = parse(attenteQuery, req.query, 400),
      result = await service.listWaiting(query);
    res.json(offsetResult(req, result.data, result.total, query));
  });
  router.get("/listes_attente/:id", async (req, res) => {
    res.json(await service.getWaiting(parseId(req.params.id)));
  });
  router.delete("/listes_attente/:id", async (req, res) => {
    const id = parseId(req.params.id);
    await service.getWaiting(id);
    await service.cancel(id);
    res.status(204).end();
  });
  return router;
}
