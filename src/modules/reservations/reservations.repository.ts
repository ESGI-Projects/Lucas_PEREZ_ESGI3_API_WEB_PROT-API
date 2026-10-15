import type { Database } from "../../database/pool.js";
import type {
  AttenteQuery,
  Cursor,
  HistoriqueQuery,
  Reservation,
  Waiting,
} from "./reservations.schemas.js";
type Slot = {
  id: number;
  cours_id: number;
  debut: string;
  fin: string;
  capacite: number;
};
type Subscription = { formule: string; quota_hebdo: number };
export function reservationsRepository(db: Database) {
  return {
    async find(id: number) {
      return (
        await db.query<Reservation>("SELECT * FROM reservations WHERE id=$1", [
          id,
        ])
      ).rows[0];
    },
    async findWaiting(id: number) {
      return (
        await db.query<Waiting>("SELECT * FROM listes_attente WHERE id=$1", [
          id,
        ])
      ).rows[0];
    },
    async lockSlot(id: number) {
      return (
        await db.query<Slot>("SELECT * FROM creneaux WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
    },
    async lockMembers(ids: number[]) {
      return (
        await db.query<{ id: number }>(
          "SELECT id FROM adherents WHERE id=ANY($1::integer[]) ORDER BY id FOR UPDATE",
          [ids],
        )
      ).rows;
    },
    async subscription(member: number, date: string) {
      return (
        await db.query<Subscription>(
          "SELECT formule,quota_hebdo FROM abonnements WHERE adherent_id=$1 AND debut<=$2::date AND fin>=$2::date",
          [member, date],
        )
      ).rows[0];
    },
    async weeklyCount(member: number, from: string, to: string) {
      return (
        await db.query<{ count: number }>(
          `SELECT count(*)::integer AS count FROM reservations r JOIN creneaux c ON c.id=r.creneau_id
       WHERE r.adherent_id=$1 AND r.statut='confirmee' AND c.debut>=$2::timestamptz AND c.debut<$3::timestamptz`,
          [member, from, to],
        )
      ).rows[0]!.count;
    },
    async active(slot: number, member: number) {
      return Boolean(
        (
          await db.query(
            "SELECT id FROM reservations WHERE creneau_id=$1 AND adherent_id=$2 AND statut IN ('confirmee','en_attente')",
            [slot, member],
          )
        ).rowCount,
      );
    },
    async confirmed(slot: number) {
      return (
        await db.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM reservations WHERE creneau_id=$1 AND statut='confirmee'",
          [slot],
        )
      ).rows[0]!.count;
    },
    async create(
      slot: number,
      member: number,
      status: "confirmee" | "en_attente",
    ) {
      return (
        await db.query<Reservation>(
          "INSERT INTO reservations(creneau_id,adherent_id,statut) VALUES($1,$2,$3) RETURNING *",
          [slot, member, status],
        )
      ).rows[0]!;
    },
    async updateStatus(
      id: number,
      status: Reservation["statut"],
      reason: string | null = null,
    ) {
      return (
        await db.query<Reservation>(
          "UPDATE reservations SET statut=$2,motif=$3 WHERE id=$1 RETURNING *",
          [id, status, reason],
        )
      ).rows[0]!;
    },
    async waiting(slot: number) {
      return (
        await db.query<Reservation>(
          "SELECT * FROM reservations WHERE creneau_id=$1 AND statut='en_attente' ORDER BY cree_le,id",
          [slot],
        )
      ).rows;
    },
    async history(q: HistoriqueQuery, cursor?: Cursor) {
      const values: unknown[] = [],
        conditions: string[] = [];
      const add = (sql: string, value: unknown) => {
        values.push(value);
        conditions.push(sql.replace("?", `$${values.length}`));
      };
      if (q.adherent) add("adherent_id=?", q.adherent);
      if (q.creneau) add("creneau_id=?", q.creneau);
      if (cursor) {
        values.push(cursor.time, cursor.id);
        conditions.push(
          `(cree_le,id)<($${values.length - 1}::timestamptz,$${values.length}::integer)`,
        );
      }
      const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";
      return (
        await db.query<Reservation>(
          `SELECT * FROM reservations ${where} ORDER BY cree_le DESC,id DESC LIMIT $${values.length + 1}`,
          [...values, q.limit + 1],
        )
      ).rows;
    },
    async offsetHistory(q: HistoriqueQuery & { page: number }) {
      const values: unknown[] = [],
        conditions: string[] = [];
      if (q.adherent) {
        values.push(q.adherent);
        conditions.push(`adherent_id=$${values.length}`);
      }
      if (q.creneau) {
        values.push(q.creneau);
        conditions.push(`creneau_id=$${values.length}`);
      }
      const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";
      const total = (
        await db.query<{ total: number }>(
          `SELECT count(*)::integer AS total FROM reservations ${where}`,
          values,
        )
      ).rows[0]!.total;
      const data = (
        await db.query<Reservation>(
          `SELECT * FROM reservations ${where} ORDER BY cree_le DESC,id DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
          [...values, q.limit, (q.page - 1) * q.limit],
        )
      ).rows;
      return { data, total };
    },
    async listWaiting(q: AttenteQuery) {
      const where = q.creneau ? "WHERE creneau_id=$1" : "";
      const values: unknown[] = q.creneau ? [q.creneau] : [];
      const total = (
        await db.query<{ total: number }>(
          `SELECT count(*)::integer AS total FROM listes_attente ${where}`,
          values,
        )
      ).rows[0]!.total;
      const data = (
        await db.query<Waiting>(
          `SELECT * FROM listes_attente ${where} ORDER BY creneau_id,cree_le,id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
          [...values, q.limit, (q.page - 1) * q.limit],
        )
      ).rows;
      return { data, total };
    },
  };
}
export type ReservationsRepository = ReturnType<typeof reservationsRepository>;
