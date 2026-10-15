import type { Pool } from "pg";
import { transaction } from "../../database/transaction.js";
import { notFound } from "../../http/errors.js";
import { parse } from "../../http/validation.js";
import { checkIfMatch, courseEtag } from "../../http/etag.js";
import { coursRepository, type CoursRepository } from "./cours.repository.js";
import { coursInput, type CoursInput } from "./cours.schemas.js";
import type { Page } from "../../http/pagination.js";

export function coursService(pool: Pool, repository: CoursRepository) {
  return {
    coaches: (page: Page) => repository.coaches(page),
    list: (page: Page) => repository.list(page),
    async get(id: number) {
      const row = await repository.find(id);
      if (!row) throw notFound("Cours");
      return row;
    },
    async create(input: CoursInput) {
      if (!(await repository.coachExists(input.coach_id)))
        throw notFound("Coach");
      return repository.create(input);
    },
    async update(id: number, patch: Partial<CoursInput>, ifMatch?: string) {
      return transaction(pool, async (client) => {
        const repo = coursRepository(client);
        const current = await repo.find(id, true);
        if (!current) throw notFound("Cours");
        checkIfMatch(ifMatch, courseEtag(current));
        // Revalide l'ensemble après fusion : un PATCH peut inverser les dates.
        const { id: _id, version: _version, ...values } = current;
        const input = parse(coursInput, { ...values, ...patch });
        if (!(await repo.coachExists(input.coach_id))) throw notFound("Coach");
        return repo.update(id, input);
      });
    },
    async remove(id: number, ifMatch?: string) {
      await transaction(pool, async (client) => {
        const repo = coursRepository(client);
        const row = await repo.find(id, true);
        if (!row) throw notFound("Cours");
        checkIfMatch(ifMatch, courseEtag(row));
        await repo.remove(id);
      });
    },
  };
}
export type CoursService = ReturnType<typeof coursService>;
