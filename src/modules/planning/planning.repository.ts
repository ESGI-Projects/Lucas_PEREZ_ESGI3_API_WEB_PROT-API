import type { Database } from "../../database/pool.js";
import type {
  Creneau,
  CreneauInput,
  PlanningQuery,
} from "./planning.schemas.js";
const projection = `c.*, (SELECT count(*)::integer FROM reservations r WHERE r.creneau_id=c.id AND r.statut='confirmee') AS places_prises,
 c.capacite-(SELECT count(*)::integer FROM reservations r WHERE r.creneau_id=c.id AND r.statut='confirmee') AS places_restantes`;
export function planningRepository(db: Database) {
  return {
    async list(q: PlanningQuery) {
      const conditions: string[] = [],
        values: unknown[] = [];
      const add = (sql: string, value: unknown) => {
        values.push(value);
        conditions.push(sql.replace("?", `$${values.length}`));
      };
      if (q.cours) add("c.cours_id=?", q.cours);
      if (q.coach) add("co.coach_id=?", q.coach);
      if (q.jour)
        add("(c.debut AT TIME ZONE 'Europe/Paris')::date=?::date", q.jour);
      if (q.from) add("c.debut>=?::timestamptz", q.from);
      if (q.to) add("c.debut<?::timestamptz", q.to);
      const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";
      const count = await db.query<{ total: number }>(
        `SELECT count(*)::integer AS total FROM creneaux c JOIN cours co ON co.id=c.cours_id ${where}`,
        values,
      );
      const sort = { "debut,id": "c.debut", "fin,id": "c.fin", id: "c.id" }[
        q.tri
      ];
      // Les seuls fragments interpolés proviennent des listes fermées ci-dessus.
      const order = q.ordre === "asc" ? "ASC" : "DESC";
      const data = await db.query<Creneau>(
        `SELECT ${projection} FROM creneaux c JOIN cours co ON co.id=c.cours_id ${where}
        ORDER BY ${sort} ${order},c.id ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, q.limit, (q.page - 1) * q.limit],
      );
      return { data: data.rows, total: count.rows[0]!.total };
    },
    async find(id: number) {
      return (
        await db.query<Creneau>(
          `SELECT ${projection} FROM creneaux c WHERE c.id=$1`,
          [id],
        )
      ).rows[0];
    },
    async create(coursId: number, capacite: number, input: CreneauInput) {
      return (
        await db.query<Creneau>(
          `INSERT INTO creneaux(cours_id,capacite,debut,fin) VALUES($1,$2,$3,$4) RETURNING *`,
          [coursId, capacite, input.debut, input.fin],
        )
      ).rows[0]!;
    },
  };
}
export type PlanningRepository = ReturnType<typeof planningRepository>;
