import type { Pool } from "pg";
import { transaction } from "../../database/transaction.js";
import { AppError, conflict, notFound } from "../../http/errors.js";
import { parse } from "../../http/validation.js";
import {
  reservationsRepository,
  type ReservationsRepository,
} from "./reservations.repository.js";
import { assertQuota, reservationPeriod } from "./reservation-policy.js";
import {
  cursorSchema,
  type AttenteQuery,
  type HistoriqueQuery,
  type Cursor,
} from "./reservations.schemas.js";

async function eligibility(
  repo: ReservationsRepository,
  member: number,
  start: string,
  now: Date,
) {
  const period = reservationPeriod(start, now);
  const subscription = await repo.subscription(member, period.date);
  if (!subscription)
    throw conflict("Aucun abonnement valable à la date du créneau.");
  assertQuota(
    subscription.formule,
    subscription.quota_hebdo,
    await repo.weeklyCount(member, period.from, period.to),
  );
}
function decodeCursor(value: string): Cursor {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("encodage");
    return parse(
      cursorSchema,
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
      400,
    );
  } catch {
    throw new AppError(
      400,
      "curseur",
      "Curseur invalide",
      "Utilisez le lien next fourni par la collection.",
    );
  }
}
export function reservationsService(
  pool: Pool,
  repository: ReservationsRepository,
  clock: () => Date,
) {
  return {
    async get(id: number) {
      const row = await repository.find(id);
      if (!row) throw notFound("Réservation");
      return row;
    },
    async getWaiting(id: number) {
      const row = await repository.findWaiting(id);
      if (!row) throw notFound("Inscription en attente");
      return row;
    },
    listWaiting: (query: AttenteQuery) => repository.listWaiting(query),
    offsetHistory: (q: HistoriqueQuery & { page: number }) =>
      repository.offsetHistory(q),
    async history(q: HistoriqueQuery) {
      const rows = await repository.history(
        q,
        q.after ? decodeCursor(q.after) : undefined,
      );
      const hasNext = rows.length > q.limit,
        data = rows.slice(0, q.limit),
        last = data.at(-1);
      const after =
        hasNext && last
          ? Buffer.from(
              JSON.stringify({ time: last.cree_le, id: last.id }),
            ).toString("base64url")
          : null;
      return { data, after };
    },
    async create(slotId: number, member: number) {
      return transaction(pool, async (client) => {
        const repo = reservationsRepository(client);
        const slot = await repo.lockSlot(slotId);
        if (!slot) throw notFound("Créneau");
        if (!(await repo.lockMembers([member])).length)
          throw notFound("Adhérent");
        if (await repo.active(slotId, member))
          throw conflict(
            "Une inscription active existe déjà pour cet adhérent et ce créneau.",
          );
        await eligibility(repo, member, slot.debut, clock());
        const full = (await repo.confirmed(slotId)) >= slot.capacite;
        return repo.create(slotId, member, full ? "en_attente" : "confirmee");
      });
    },
    async cancel(id: number) {
      return transaction(pool, async (client) => {
        const repo = reservationsRepository(client);
        const initial = await repo.find(id);
        if (!initial) throw notFound("Réservation");
        const slot = await repo.lockSlot(initial.creneau_id);
        if (!slot) throw notFound("Créneau");
        const current = (await repo.find(id))!;
        if (current.statut === "annulee") return current;
        if (current.statut === "retiree")
          throw conflict(
            "Cette inscription a déjà été retirée de la liste d'attente.",
          );
        if (clock().getTime() >= Date.parse(slot.debut))
          throw conflict("Le créneau a déjà commencé.");
        const waiting = await repo.waiting(slot.id);
        // Ordre unique : créneau, puis tous les adhérents concernés par id croissant.
        await repo.lockMembers([
          ...new Set([
            current.adherent_id,
            ...waiting.map((r) => r.adherent_id),
          ]),
        ]);
        const cancelled = await repo.updateStatus(id, "annulee");
        if (current.statut === "confirmee") {
          for (const candidate of waiting) {
            try {
              await eligibility(
                repo,
                candidate.adherent_id,
                slot.debut,
                clock(),
              );
            } catch (error) {
              if (!(error instanceof AppError) || error.status !== 409)
                throw error;
              await repo.updateStatus(candidate.id, "retiree", error.message);
              continue;
            }
            await repo.updateStatus(candidate.id, "confirmee");
            break;
          }
        }
        return cancelled;
      });
    },
  };
}
export type ReservationsService = ReturnType<typeof reservationsService>;
