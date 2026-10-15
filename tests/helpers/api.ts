import { once } from "node:events";
import type { Server } from "node:http";
import { createPool } from "../../src/database/pool.js";
import { createApp } from "../../src/app.js";

if (
  process.env.NODE_ENV !== "test" ||
  !process.env.DATABASE_URL ||
  !new URL(process.env.DATABASE_URL).pathname.endsWith("_test")
)
  throw new Error(
    "Les tests exigent NODE_ENV=test et une base dont le nom se termine par _test.",
  );
export const pool = createPool(process.env.DATABASE_URL);
export const now = new Date("2026-10-15T10:00:00Z");
let server: Server;
let base: string;
export async function start() {
  server = createApp(pool, { clock: () => now }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Adresse HTTP manquante");
  base = `http://127.0.0.1:${address.port}`;
}
export async function stop() {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await pool.end();
}
export async function reset() {
  await pool.query(
    "TRUNCATE reservations,creneaux,cours,abonnements,adherents,coachs RESTART IDENTITY CASCADE",
  );
}
export async function request(
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    text,
    body: text ? JSON.parse(text) : null,
  };
}
export async function malformed() {
  const response = await fetch(base + "/adherents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"nom":',
  });
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  };
}
export async function fixture({
  capacity = 1,
  quota = 2,
  members = 3,
  slots = 1,
  formule = "premium",
} = {}) {
  const coach = (
    await pool.query(
      "INSERT INTO coachs(nom,email) VALUES('Coach','coach@example.org') RETURNING id",
    )
  ).rows[0].id as number;
  const courseInput = {
    type: "Yoga",
    coach_id: coach,
    capacite: capacity,
    jour_semaine: 5,
    heure_debut: "12:00",
    duree_min: 60,
    periode_debut: "2026-10-01",
    periode_fin: "2026-12-31",
    fuseau: "Europe/Paris",
  };
  const course = (await request("/cours", "POST", courseInput)).body;
  const ids: number[] = [];
  for (let i = 0; i < members; i++) {
    const member = (
      await request("/adherents", "POST", {
        nom: `Membre ${i}`,
        email: `membre${i}@example.org`,
      })
    ).body;
    ids.push(member.id);
    await pool.query(
      "INSERT INTO abonnements(adherent_id,formule,debut,fin,quota_hebdo) VALUES($1,$2,$3,$4,$5)",
      [member.id, formule, "2026-10-01", "2026-12-31", quota],
    );
  }
  const slotIds: number[] = [];
  for (let i = 0; i < slots; i++) {
    const start = new Date(Date.parse("2026-10-16T10:00:00Z") + i * 3600000);
    const slot = await request(`/cours/${course.id}/creneaux`, "POST", {
      debut: start.toISOString(),
      fin: new Date(start.getTime() + 3600000).toISOString(),
    });
    slotIds.push(slot.body.id);
  }
  return { course, courseInput, members: ids, slots: slotIds };
}
export const book = (slot: number, member: number) =>
  request(`/creneaux/${slot}/reservations`, "POST", { adherent_id: member });
export const cancel = (id: number) =>
  request(`/reservations/${id}`, "PATCH", { statut: "annulee" });
