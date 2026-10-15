import type { Database } from "../../database/pool.js";
import type { Page } from "../../http/pagination.js";
import type { Adherent, AdherentInput } from "./adherents.schemas.js";

export function adherentsRepository(db: Database) {
  return {
    async list({ page, limit }: Page) {
      const data = await db.query<Adherent>(
        "SELECT * FROM adherents ORDER BY id LIMIT $1 OFFSET $2",
        [limit, (page - 1) * limit],
      );
      const total = await db.query<{ total: number }>(
        "SELECT count(*)::integer AS total FROM adherents",
      );
      return { data: data.rows, total: total.rows[0]!.total };
    },
    async subscriptions({ page, limit }: Page) {
      const data = await db.query(
        "SELECT * FROM abonnements ORDER BY id LIMIT $1 OFFSET $2",
        [limit, (page - 1) * limit],
      );
      const total = (
        await db.query<{ total: number }>(
          "SELECT count(*)::integer AS total FROM abonnements",
        )
      ).rows[0]!.total;
      return { data: data.rows, total };
    },
    async find(id: number) {
      return (
        await db.query<Adherent>("SELECT * FROM adherents WHERE id=$1", [id])
      ).rows[0];
    },
    async create(input: AdherentInput) {
      return (
        await db.query<Adherent>(
          "INSERT INTO adherents(nom,email) VALUES ($1,$2) RETURNING *",
          [input.nom, input.email],
        )
      ).rows[0]!;
    },
    async update(id: number, input: Partial<AdherentInput>) {
      return (
        await db.query<Adherent>(
          `UPDATE adherents SET nom=COALESCE($2,nom), email=COALESCE($3,email) WHERE id=$1 RETURNING *`,
          [id, input.nom, input.email],
        )
      ).rows[0];
    },
    async remove(id: number) {
      return (await db.query("DELETE FROM adherents WHERE id=$1", [id]))
        .rowCount;
    },
  };
}
export type AdherentsRepository = ReturnType<typeof adherentsRepository>;
