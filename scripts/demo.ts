import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { seedDemo } from "../db/seeds/demo.js";
import { createPool } from "../src/database/pool.js";
import { readEnv } from "../src/config/env.js";

const pool = createPool(readEnv().DATABASE_URL);
const base = process.env.API_URL ?? "http://api:3000";
const capture = process.env.CAPTURE_FILE ?? "docs/captures/demo.json";
const exchanges: unknown[] = [];
async function http(
  label: string,
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
  const result = {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: text ? JSON.parse(text) : null,
  };
  exchanges.push({
    label,
    request: { method, path, headers, body },
    response: result,
  });
  console.log(
    `${label} : ${result.status}${result.body?.statut ? ` (${result.body.statut})` : ""}`,
  );
  return result;
}
try {
  const fixture = await seedDemo(pool);
  console.log("Données de démonstration", JSON.stringify(fixture));
  const path = `/creneaux/${fixture.creneau}/reservations`;
  const lastPlace = await Promise.all(
    fixture.adherents.slice(0, 2).map((id, i) =>
      http(`Dernière place / client ${i + 1}`, path, "POST", {
        adherent_id: id,
      }),
    ),
  );
  assert.deepEqual(
    lastPlace.map((r) => r.status),
    [201, 201],
  );
  assert.deepEqual(lastPlace.map((r) => r.body.statut).sort(), [
    "confirmee",
    "en_attente",
  ]);
  const course = await http("Lecture cours", `/cours/${fixture.cours}`);
  const tag = course.headers.etag!;
  assert.equal(
    (
      await http(
        "Cache conditionnel",
        `/cours/${fixture.cours}`,
        "GET",
        undefined,
        { "If-None-Match": tag },
      )
    ).status,
    304,
  );
  assert.equal(
    (
      await http(
        "Modification conditionnelle",
        `/cours/${fixture.cours}`,
        "PATCH",
        { type: "Démo mise à jour" },
        { "If-Match": tag },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await http(
        "Version obsolète",
        `/cours/${fixture.cours}`,
        "PATCH",
        { type: "Ancienne version" },
        { "If-Match": tag },
      )
    ).status,
    412,
  );
  assert.equal(
    (
      await http("Validation multi-champs", "/adherents", "POST", {
        nom: "",
        email: "invalide",
      })
    ).status,
    422,
  );
  const first = await http(
    "Curseur / première page",
    `/reservations?creneau=${fixture.creneau}&limit=1`,
  );
  const offset = await http(
    "Offset / première page",
    `/reservations?creneau=${fixture.creneau}&page=1&limit=1`,
  );
  await http("Insertion entre les pages", path, "POST", {
    adherent_id: fixture.adherents[2],
  });
  const next = await http("Curseur / page suivante", first.body.links.next);
  const moved = await http("Offset / page suivante", offset.body.links.next);
  assert.notEqual(first.body.data[0].id, next.body.data[0].id);
  assert.equal(offset.body.data[0].id, moved.body.data[0].id);
  assert.ok(fixture.debut);
  const start = new Date(fixture.debut);
  start.setHours(start.getHours() + 2);
  const other = await http(
    "Création créneau doublon",
    `/cours/${fixture.cours}/creneaux`,
    "POST",
    {
      debut: start.toISOString(),
      fin: new Date(start.getTime() + 3600000).toISOString(),
    },
  );
  assert.equal(other.status, 201);
  const duplicates = await Promise.all(
    [1, 2].map((i) =>
      http(
        `Doublon concurrent / client ${i}`,
        `/creneaux/${other.body.id}/reservations`,
        "POST",
        { adherent_id: fixture.adherents[3] },
      ),
    ),
  );
  assert.deepEqual(duplicates.map((r) => r.status).sort(), [201, 409]);
  const confirmed = lastPlace.find((r) => r.body.statut === "confirmee")!;
  assert.equal(
    (
      await http(
        "Annulation et promotion",
        `/reservations/${confirmed.body.id}`,
        "PATCH",
        { statut: "annulee" },
      )
    ).status,
    200,
  );
  await http("Planning final", `/creneaux?cours=${fixture.cours}&tri=debut,id`);
  await mkdir(dirname(capture), { recursive: true });
  await writeFile(
    capture,
    JSON.stringify(
      { captured_at: new Date().toISOString(), fixture, exchanges },
      null,
      2,
    ) + "\n",
  );
  console.log(`Démonstration vérifiée, capture : ${capture}`);
} finally {
  await pool.end();
}
