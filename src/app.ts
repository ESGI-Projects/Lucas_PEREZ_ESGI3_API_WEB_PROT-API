import express from "express";
import type { Pool } from "pg";
import { AppError, notFound } from "./http/errors.js";
import { errorHandler } from "./http/error-handler.js";
import { adherentsRepository } from "./modules/adherents/adherents.repository.js";
import { adherentsService } from "./modules/adherents/adherents.service.js";
import {
  adherentsRoutes,
  abonnementsRoutes,
} from "./modules/adherents/adherents.routes.js";
import { coursRepository } from "./modules/cours/cours.repository.js";
import { coursService } from "./modules/cours/cours.service.js";
import { coursRoutes, coachsRoutes } from "./modules/cours/cours.routes.js";
import { planningRepository } from "./modules/planning/planning.repository.js";
import { planningService } from "./modules/planning/planning.service.js";
import { planningRoutes } from "./modules/planning/planning.routes.js";
import { reservationsRepository } from "./modules/reservations/reservations.repository.js";
import { reservationsService } from "./modules/reservations/reservations.service.js";
import { reservationsRoutes } from "./modules/reservations/reservations.routes.js";

export function createApp(
  pool: Pool,
  { clock = () => new Date() }: { clock?: () => Date } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.disable("etag"); // ETag explicite sur la ressource cours uniquement.
  app.set("query parser", "simple");
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      ["POST", "PUT", "PATCH"].includes(req.method) &&
      !req.is("application/json")
    )
      return next(
        new AppError(
          415,
          "media",
          "Type de contenu non pris en charge",
          "Utilisez Content-Type: application/json.",
        ),
      );
    next();
  });
  app.use(express.json({ limit: "100kb" }));
  app.get("/health", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  });
  const members = adherentsService(adherentsRepository(pool));
  const courses = coursService(pool, coursRepository(pool));
  app.use("/adherents", adherentsRoutes(members));
  app.use("/abonnements", abonnementsRoutes(members));
  app.use("/cours", coursRoutes(courses));
  app.use("/coachs", coachsRoutes(courses));
  app.use(planningRoutes(planningService(pool, planningRepository(pool))));
  app.use(
    reservationsRoutes(
      reservationsService(pool, reservationsRepository(pool), clock),
    ),
  );
  app.use((_req, _res, next) => next(notFound("Route")));
  app.use(errorHandler);
  return app;
}
