import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import type { Pool } from "pg";
import { transaction } from "../../src/database/transaction.js";

export async function seedDemo(pool: Pool) {
  return transaction(pool, async (db) => {
    const run = randomUUID().slice(0, 8);
    const start = DateTime.now()
      .setZone("Europe/Paris")
      .plus({ days: 1 })
      .set({ hour: 18, minute: 0, second: 0, millisecond: 0 });
    const members: number[] = [];
    for (const name of ["Alice", "Benoît", "Chloé", "David"]) {
      const row = (
        await db.query<{ id: number }>(
          "INSERT INTO adherents(nom,email) VALUES($1,$2) RETURNING id",
          [`Démo ${name}`, `${name.toLowerCase()}-${run}@example.org`],
        )
      ).rows[0]!;
      members.push(row.id);
      await db.query(
        "INSERT INTO abonnements(adherent_id,formule,debut,fin,quota_hebdo) VALUES($1,'premium',$2,$3,2)",
        [
          row.id,
          start.minus({ days: 7 }).toISODate(),
          start.plus({ months: 1 }).toISODate(),
        ],
      );
    }
    const coach = (
      await db.query<{ id: number }>(
        "INSERT INTO coachs(nom,email) VALUES($1,$2) RETURNING id",
        ["Coach démo", `coach-${run}@example.org`],
      )
    ).rows[0]!;
    const course = (
      await db.query<{ id: number }>(
        `INSERT INTO cours(type,coach_id,capacite,jour_semaine,heure_debut,duree_min,periode_debut,periode_fin,fuseau)
      VALUES('Démo dernière place',$1,1,$2,'18:00',60,$3,$4,'Europe/Paris') RETURNING id`,
        [
          coach.id,
          start.weekday,
          start.toISODate(),
          start.plus({ months: 1 }).toISODate(),
        ],
      )
    ).rows[0]!;
    const slot = (
      await db.query<{ id: number }>(
        "INSERT INTO creneaux(cours_id,capacite,debut,fin) VALUES($1,1,$2,$3) RETURNING id",
        [
          course.id,
          start.toUTC().toISO(),
          start.plus({ hours: 1 }).toUTC().toISO(),
        ],
      )
    ).rows[0]!;
    return {
      adherents: members,
      cours: course.id,
      creneau: slot.id,
      debut: start.toISO(),
      exemple: `POST /creneaux/${slot.id}/reservations`,
      corps: { adherent_id: members[0] },
    };
  });
}
