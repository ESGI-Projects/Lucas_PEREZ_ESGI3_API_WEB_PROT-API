import type { Database } from "../../database/pool.js";
import type { Page } from "../../http/pagination.js";
import type { Cours, CoursInput } from "./cours.schemas.js";
export function coursRepository(db: Database) {
  return {
    async list({ page, limit }: Page) {
      const data = await db.query<Cours>(
        "SELECT * FROM cours ORDER BY id LIMIT $1 OFFSET $2",
        [limit, (page - 1) * limit],
      );
      const count = await db.query<{ total: number }>(
        "SELECT count(*)::integer AS total FROM cours",
      );
      return { data: data.rows, total: count.rows[0]!.total };
    },
    async coaches({ page, limit }: Page) {
      const data = await db.query(
        "SELECT * FROM coachs ORDER BY id LIMIT $1 OFFSET $2",
        [limit, (page - 1) * limit],
      );
      const total = (
        await db.query<{ total: number }>(
          "SELECT count(*)::integer AS total FROM coachs",
        )
      ).rows[0]!.total;
      return { data: data.rows, total };
    },
    async find(id: number, lock = false) {
      return (
        await db.query<Cours>(
          `SELECT * FROM cours WHERE id=$1${lock ? " FOR UPDATE" : ""}`,
          [id],
        )
      ).rows[0];
    },
    async coachExists(id: number) {
      return Boolean(
        (await db.query("SELECT id FROM coachs WHERE id=$1", [id])).rowCount,
      );
    },
    async create(input: CoursInput) {
      return (
        await db.query<Cours>(
          `INSERT INTO cours(type,coach_id,capacite,jour_semaine,heure_debut,duree_min,periode_debut,periode_fin,fuseau)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [
            input.type,
            input.coach_id,
            input.capacite,
            input.jour_semaine,
            input.heure_debut,
            input.duree_min,
            input.periode_debut,
            input.periode_fin,
            input.fuseau,
          ],
        )
      ).rows[0]!;
    },
    async update(id: number, input: CoursInput) {
      return (
        await db.query<Cours>(
          `UPDATE cours SET type=$2,coach_id=$3,capacite=$4,jour_semaine=$5,heure_debut=$6,duree_min=$7,
        periode_debut=$8,periode_fin=$9,fuseau=$10,version=version+1 WHERE id=$1 RETURNING *`,
          [
            id,
            input.type,
            input.coach_id,
            input.capacite,
            input.jour_semaine,
            input.heure_debut,
            input.duree_min,
            input.periode_debut,
            input.periode_fin,
            input.fuseau,
          ],
        )
      ).rows[0]!;
    },
    async remove(id: number) {
      await db.query("DELETE FROM cours WHERE id=$1", [id]);
    },
  };
}
export type CoursRepository = ReturnType<typeof coursRepository>;
