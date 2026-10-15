import type { Pool } from "pg";
import { DateTime } from "luxon";
import { transaction } from "../../database/transaction.js";
import { AppError, notFound } from "../../http/errors.js";
import { coursRepository } from "../cours/cours.repository.js";
import {
  planningRepository,
  type PlanningRepository,
} from "./planning.repository.js";
import type { CreneauInput, PlanningQuery } from "./planning.schemas.js";
export function planningService(pool: Pool, repository: PlanningRepository) {
  return {
    list: (query: PlanningQuery) => repository.list(query),
    async listForCourse(id: number, query: PlanningQuery) {
      if (!(await coursRepository(pool).find(id))) throw notFound("Cours");
      return repository.list({ ...query, cours: id });
    },
    async get(id: number) {
      const row = await repository.find(id);
      if (!row) throw notFound("Créneau");
      return row;
    },
    async create(coursId: number, input: CreneauInput) {
      return transaction(pool, async (client) => {
        const course = await coursRepository(client).find(coursId, true);
        if (!course) throw notFound("Cours");
        const local = DateTime.fromISO(input.debut, { zone: "Europe/Paris" });
        const duration =
          (Date.parse(input.fin) - Date.parse(input.debut)) / 60000;
        if (
          local.toISODate()! < course.periode_debut ||
          local.toISODate()! > course.periode_fin ||
          duration !== course.duree_min
        )
          throw new AppError(
            422,
            "validation",
            "Créneau invalide",
            "Respectez la période et la durée du cours.",
            [
              {
                field: "debut/fin",
                message: "Période ou durée incompatible avec le cours.",
              },
            ],
          );
        return planningRepository(client).create(
          coursId,
          course.capacite,
          input,
        );
      });
    },
  };
}
export type PlanningService = ReturnType<typeof planningService>;
