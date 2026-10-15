import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  pool,
  start,
  stop,
  reset,
  request,
  malformed,
  fixture,
  book,
  cancel,
} from "../helpers/api.js";

before(start);
after(stop);
beforeEach(reset);

test("CRUD adhérents : Location, PUT complet, PATCH partiel, DELETE et 404", async () => {
  const created = await request("/adherents", "POST", {
    nom: "Alice",
    email: "ALICE@example.org",
  });
  assert.equal(created.status, 201);
  assert.equal(
    created.headers.get("location"),
    `/adherents/${created.body.id}`,
  );
  const path = created.headers.get("location")!;
  assert.equal((await request(path)).body.email, "alice@example.org");
  assert.equal((await request(path, "PUT", { nom: "Autre" })).status, 422);
  assert.equal(
    (await request(path, "PUT", { nom: "Bob", email: "bob@example.org" }))
      .status,
    200,
  );
  const patch = await request(path, "PATCH", { nom: "Robert" });
  assert.equal(patch.body.email, "bob@example.org");
  assert.equal((await request("/adherents?limit=1")).body.pagination.total, 1);
  const removed = await request(path, "DELETE");
  assert.equal(removed.status, 204);
  assert.equal(removed.text, "");
  assert.equal((await request(path, "DELETE")).status, 404);
});

test("validation : détail multi-champs, champs inconnus et PATCH vide", async () => {
  const invalid = await request("/adherents", "POST", {
    nom: "",
    email: "pas-un-email",
  });
  assert.equal(invalid.status, 422);
  assert.match(
    invalid.headers.get("content-type")!,
    /application\/problem\+json/,
  );
  assert.deepEqual(
    invalid.body.errors.map((e: { field: string }) => e.field),
    ["nom", "email"],
  );
  assert.equal(
    (
      await request("/adherents", "POST", {
        nom: "Alice",
        email: "a@example.org",
        role: "admin",
      })
    ).status,
    422,
  );
  assert.equal((await request("/adherents/1", "PATCH", {})).status, 422);
});

test("JSON illisible 400, Content-Type 415, identifiant et route invalides", async () => {
  assert.equal((await malformed()).status, 400);
  assert.equal((await request("/adherents", "POST")).status, 415);
  assert.equal((await request("/adherents/abc")).status, 400);
  const absent = await request("/inexistant");
  assert.equal(absent.status, 404);
  assert.equal(absent.body.status, 404);
  assert.equal("stack" in absent.body, false);
});

test("CRUD cours : remplacement, patch, précondition, suppression et relation protégée", async () => {
  const f = await fixture();
  assert.equal((await request(`/cours/${f.course.id}`, "DELETE")).status, 409);
  const created = await request("/cours", "POST", {
    ...f.courseInput,
    type: "Pilates",
  });
  const path = created.headers.get("location")!;
  assert.equal((await request(path)).body.type, "Pilates");
  assert.equal((await request(path, "PUT", { type: "Partiel" })).status, 422);
  assert.equal(
    (await request(path, "PUT", { ...f.courseInput, type: "Complet" })).body
      .type,
    "Complet",
  );
  assert.equal(
    (await request(path, "PATCH", { periode_fin: "2025-01-01" })).status,
    422,
  );
  assert.equal((await request(path, "DELETE")).status, 204);
  assert.equal((await request(path)).status, 404);
});

test("ETag : 304 vide, évolution du tag et 412 sur écriture obsolète", async () => {
  const f = await fixture(),
    path = `/cours/${f.course.id}`;
  const read = await request(path),
    tag = read.headers.get("etag")!;
  const cached = await request(path, "GET", undefined, {
    "If-None-Match": `W/${tag}`,
  });
  assert.equal(cached.status, 304);
  assert.equal(cached.text, "");
  const updated = await request(
    path,
    "PATCH",
    { type: "Pilates" },
    { "If-Match": tag },
  );
  assert.equal(updated.status, 200);
  assert.notEqual(updated.headers.get("etag"), tag);
  assert.equal(
    (await request(path, "PATCH", { type: "Perdu" }, { "If-Match": tag }))
      .status,
    412,
  );
  assert.equal((await request(path)).body.type, "Pilates");
});

test("ETag concurrent : une seule écriture peut utiliser la même version", async () => {
  const f = await fixture(),
    path = `/cours/${f.course.id}`,
    tag = (await request(path)).headers.get("etag")!;
  const results = await Promise.all(
    ["A", "B"].map((type) =>
      request(path, "PATCH", { type }, { "If-Match": tag }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 412]);
});

test("planning : filtres combinés, tri stable, liens conservant les paramètres", async () => {
  const f = await fixture({ slots: 3 });
  const path = `/creneaux?cours=${f.course.id}&coach=${f.course.coach_id}&jour=2026-10-16&limit=1&tri=debut,id&ordre=asc`;
  const first = await request(path);
  assert.equal(first.body.pagination.total, 3);
  assert.equal(first.body.data.length, 1);
  const second = await request(first.body.links.next);
  assert.notEqual(second.body.data[0].id, first.body.data[0].id);
  assert.match(second.body.links.prev, /coach=/);
  assert.equal((await request("/creneaux?from=hier")).status, 400);
  assert.equal((await request("/creneaux?tri=debut;DROP")).status, 400);
  assert.equal((await request("/creneaux/999")).status, 404);
});

test("créneau : durée et période validées ; capacité figée à la création", async () => {
  const f = await fixture();
  assert.equal(
    (
      await request(`/cours/${f.course.id}/creneaux`, "POST", {
        debut: "2026-10-17T10:00:00Z",
        fin: "2026-10-17T10:30:00Z",
      })
    ).status,
    422,
  );
  await request(`/cours/${f.course.id}`, "PATCH", { capacite: 5 });
  assert.equal((await request(`/creneaux/${f.slots[0]}`)).body.capacite, 1);
});

test("deux adhérents sur la dernière place : une confirmation, une attente", async () => {
  const f = await fixture();
  const results = await Promise.all(
    f.members.slice(0, 2).map((id) => book(f.slots[0]!, id)),
  );
  assert.deepEqual(
    results.map((r) => r.status),
    [201, 201],
  );
  assert.deepEqual(results.map((r) => r.body.statut).sort(), [
    "confirmee",
    "en_attente",
  ]);
  for (const r of results)
    assert.equal((await request(r.headers.get("location")!)).status, 200);
  const planning = await request(`/creneaux/${f.slots[0]}`);
  assert.equal(planning.body.places_prises, 1);
  assert.equal(planning.body.places_restantes, 0);
});

test("même adhérent concurrent : un 201, un 409 problem+json", async () => {
  const f = await fixture();
  const results = await Promise.all([
    book(f.slots[0]!, f.members[0]!),
    book(f.slots[0]!, f.members[0]!),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const failure = results.find((r) => r.status === 409)!;
  assert.match(
    failure.headers.get("content-type")!,
    /application\/problem\+json/,
  );
});

test("quota concurrent sur deux créneaux différents : une seule confirmation", async () => {
  const f = await fixture({ quota: 1, slots: 2 });
  const results = await Promise.all(
    f.slots.map((id) => book(id, f.members[0]!)),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::integer AS n FROM reservations WHERE statut='confirmee'",
      )
    ).rows[0].n,
    1,
  );
});

test("abonnement absent, quota atteint, fenêtre trop tôt et créneau passé", async () => {
  const f = await fixture({ quota: 1, slots: 2 });
  await pool.query("DELETE FROM abonnements WHERE adherent_id=$1", [
    f.members[1],
  ]);
  assert.equal((await book(f.slots[0]!, f.members[1]!)).status, 409);
  assert.equal((await book(f.slots[0]!, 999)).status, 404);
  assert.equal((await book(999, f.members[0]!)).status, 404);
  assert.equal((await book(f.slots[0]!, f.members[0]!)).status, 201);
  assert.equal((await book(f.slots[1]!, f.members[0]!)).status, 409);
  await pool.query(
    "UPDATE creneaux SET debut='2026-11-01T10:00Z',fin='2026-11-01T11:00Z' WHERE id=$1",
    [f.slots[1]],
  );
  assert.equal((await book(f.slots[1]!, f.members[2]!)).status, 409);
  await pool.query(
    "UPDATE creneaux SET debut='2026-10-14T10:00Z',fin='2026-10-14T11:00Z' WHERE id=$1",
    [f.slots[1]],
  );
  assert.equal((await book(f.slots[1]!, f.members[2]!)).status, 409);
});

test("formule illimitée : aucune limite hebdomadaire malgré la valeur du kit", async () => {
  const f = await fixture({ quota: 1, slots: 2, formule: "illimite" });
  assert.equal((await book(f.slots[0]!, f.members[0]!)).status, 201);
  assert.equal((await book(f.slots[1]!, f.members[0]!)).status, 201);
});

test("annulation : promotion FIFO atomique et répétition sans seconde promotion", async () => {
  const f = await fixture();
  const a = await book(f.slots[0]!, f.members[0]!),
    b = await book(f.slots[0]!, f.members[1]!),
    c = await book(f.slots[0]!, f.members[2]!);
  const waiting = await request(`/listes_attente?creneau=${f.slots[0]}`);
  assert.deepEqual(
    waiting.body.data.map((r: { rang: number }) => r.rang),
    [1, 2],
  );
  assert.equal((await cancel(a.body.id)).body.statut, "annulee");
  assert.equal(
    (await request(`/reservations/${b.body.id}`)).body.statut,
    "confirmee",
  );
  assert.equal((await cancel(a.body.id)).status, 200);
  assert.equal(
    (await request(`/reservations/${c.body.id}`)).body.statut,
    "en_attente",
  );
  assert.equal((await request(`/listes_attente/${c.body.id}`)).body.rang, 1);
});

test("promotion : retrait motivé du premier devenu inéligible", async () => {
  const f = await fixture();
  const a = await book(f.slots[0]!, f.members[0]!),
    b = await book(f.slots[0]!, f.members[1]!),
    c = await book(f.slots[0]!, f.members[2]!);
  await pool.query("DELETE FROM abonnements WHERE adherent_id=$1", [
    f.members[1],
  ]);
  await cancel(a.body.id);
  const retired = await request(`/reservations/${b.body.id}`);
  assert.equal(retired.body.statut, "retiree");
  assert.match(retired.body.motif, /abonnement/);
  assert.equal(
    (await request(`/reservations/${c.body.id}`)).body.statut,
    "confirmee",
  );
});

test("annulation attente ne libère pas de place et permet une réinscription", async () => {
  const f = await fixture();
  await book(f.slots[0]!, f.members[0]!);
  const waiting = await book(f.slots[0]!, f.members[1]!);
  assert.equal(
    (await request(`/listes_attente/${waiting.body.id}`, "DELETE")).status,
    204,
  );
  assert.equal(
    (await book(f.slots[0]!, f.members[1]!)).body.statut,
    "en_attente",
  );
  assert.equal(
    (await request(`/creneaux/${f.slots[0]}`)).body.places_prises,
    1,
  );
});

test("curseur : précision microseconde, insertion avant la page, aucun doublon ni saut", async () => {
  const f = await fixture({ capacity: 5 });
  const ids: number[] = [];
  for (const member of f.members)
    ids.push((await book(f.slots[0]!, member)).body.id);
  await pool.query(
    "UPDATE reservations SET cree_le='2026-10-15T10:00:00.123456Z'::timestamptz+id*interval '1 microsecond'",
  );
  const first = await request("/reservations?limit=1");
  assert.equal(first.body.data[0].id, ids[2]);
  assert.match(first.body.data[0].cree_le, /123459/);
  await pool.query(
    "INSERT INTO reservations(creneau_id,adherent_id,statut,cree_le) VALUES($1,$2,'annulee','2026-10-15T11:00:00Z')",
    [f.slots[0], f.members[0]],
  );
  const found = [first.body.data[0].id];
  let next = first.body.links.next;
  while (next) {
    const page = await request(next);
    found.push(...page.body.data.map((r: { id: number }) => r.id));
    next = page.body.links.next;
  }
  assert.deepEqual(found, ids.toReversed());
  assert.equal((await request("/reservations?after=invalide")).status, 400);
});

test("contraintes SQL : doublons actifs et chevauchement abonnements refusés", async () => {
  const f = await fixture();
  await book(f.slots[0]!, f.members[0]!);
  await assert.rejects(
    pool.query(
      "INSERT INTO reservations(creneau_id,adherent_id,statut) VALUES($1,$2,'en_attente')",
      [f.slots[0], f.members[0]],
    ),
    { code: "23505" },
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO abonnements(adherent_id,formule,debut,fin,quota_hebdo) VALUES($1,'premium','2026-10-02','2026-10-03',2)",
      [f.members[0]],
    ),
    { code: "23P01" },
  );
});

test("consultations de référence : enveloppe commune et suppression protégée", async () => {
  const f = await fixture();
  for (const path of ["/coachs", "/abonnements"]) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.data));
    assert.ok(response.body.links);
  }
  assert.equal(
    (await request(`/adherents/${f.members[0]}`, "DELETE")).status,
    409,
  );
});

test("offset comparé au curseur : une insertion décale la deuxième page", async () => {
  const f = await fixture({ capacity: 5 });
  for (const member of f.members) await book(f.slots[0]!, member);
  const first = await request("/reservations?page=1&limit=1");
  const cursor = await request("/reservations?limit=1");
  await pool.query(
    "INSERT INTO reservations(creneau_id,adherent_id,statut) VALUES($1,$2,'annulee')",
    [f.slots[0], f.members[0]],
  );
  const offsetNext = await request(first.body.links.next),
    cursorNext = await request(cursor.body.links.next);
  assert.equal(offsetNext.body.data[0].id, first.body.data[0].id);
  assert.notEqual(cursorNext.body.data[0].id, cursor.body.data[0].id);
  assert.equal((await request("/reservations?page=1&after=abc")).status, 400);
});

test("semaine de Paris : deux UTC de dates différentes peuvent relever du même lundi", async () => {
  const f = await fixture({ quota: 1, slots: 2 });
  // 00:30 et 02:00 lundi à Paris, mais le premier instant est encore dimanche UTC.
  await pool.query(
    "UPDATE creneaux SET debut='2026-10-18T22:30Z',fin='2026-10-18T23:30Z' WHERE id=$1",
    [f.slots[0]],
  );
  await pool.query(
    "UPDATE creneaux SET debut='2026-10-19T00:00Z',fin='2026-10-19T01:00Z' WHERE id=$1",
    [f.slots[1]],
  );
  assert.equal((await book(f.slots[0]!, f.members[0]!)).status, 201);
  assert.equal((await book(f.slots[1]!, f.members[0]!)).status, 409);
});

test("annulations concurrentes : historique cohérent, une seule promotion", async () => {
  const f = await fixture();
  const a = await book(f.slots[0]!, f.members[0]!);
  await book(f.slots[0]!, f.members[1]!);
  await book(f.slots[0]!, f.members[2]!);
  const results = await Promise.all([cancel(a.body.id), cancel(a.body.id)]);
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 200],
  );
  const counts = (
    await pool.query(
      "SELECT statut,count(*)::integer AS n FROM reservations GROUP BY statut",
    )
  ).rows;
  assert.deepEqual(Object.fromEntries(counts.map((r) => [r.statut, r.n])), {
    annulee: 1,
    confirmee: 1,
    en_attente: 1,
  });
});

test("limites de fenêtre et heure d’hiver : sept jours calendaires en Europe/Paris", async () => {
  const { reservationPeriod } =
    await import("../../src/modules/reservations/reservation-policy.js");
  // Le passage à l’heure d’hiver a lieu dans la fenêtre : sept jours = 169 h ici.
  const start = "2026-10-26T10:00:00Z";
  assert.doesNotThrow(() =>
    reservationPeriod(start, new Date("2026-10-19T09:00:00Z")),
  );
  assert.throws(() =>
    reservationPeriod(start, new Date("2026-10-19T08:59:59.999Z")),
  );
  assert.throws(() => reservationPeriod(start, new Date(start)));
  const week = reservationPeriod(start, new Date("2026-10-20T10:00:00Z"));
  assert.equal(week.from, "2026-10-25T23:00:00.000Z");
  assert.equal(week.to, "2026-11-01T23:00:00.000Z");
});

test("promotions concurrentes sur deux créneaux : le quota de l’attente reste protégé", async () => {
  const f = await fixture({ quota: 1, slots: 2 });
  const a = await book(f.slots[0]!, f.members[0]!);
  const b = await book(f.slots[1]!, f.members[1]!);
  await book(f.slots[0]!, f.members[2]!);
  await book(f.slots[1]!, f.members[2]!);
  const results = await Promise.all([cancel(a.body.id), cancel(b.body.id)]);
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 200],
  );
  const rows = (
    await pool.query(
      "SELECT statut FROM reservations WHERE adherent_id=$1 ORDER BY id",
      [f.members[2]],
    )
  ).rows;
  assert.deepEqual(rows.map((r) => r.statut).sort(), ["confirmee", "retiree"]);
});
