import { notFound } from "../../http/errors.js";
import type { AdherentsRepository } from "./adherents.repository.js";
import type { AdherentInput } from "./adherents.schemas.js";
import type { Page } from "../../http/pagination.js";

export function adherentsService(repository: AdherentsRepository) {
  return {
    subscriptions: (page: Page) => repository.subscriptions(page),
    list: (page: Page) => repository.list(page),
    async get(id: number) {
      const row = await repository.find(id);
      if (!row) throw notFound("Adhérent");
      return row;
    },
    create: (input: AdherentInput) => repository.create(input),
    async update(id: number, input: Partial<AdherentInput>) {
      const row = await repository.update(id, input);
      if (!row) throw notFound("Adhérent");
      return row;
    },
    async remove(id: number) {
      if (!(await repository.remove(id))) throw notFound("Adhérent");
    },
  };
}
export type AdherentsService = ReturnType<typeof adherentsService>;
