import { DateTime } from "luxon";
import { conflict } from "../../http/errors.js";

export const businessZone = "Europe/Paris";
export function reservationPeriod(start: string, now: Date) {
  const local = DateTime.fromISO(start, { zone: businessZone });
  const instant = now.getTime();
  if (
    instant < local.minus({ days: 7 }).toMillis() ||
    instant >= local.toMillis()
  )
    throw conflict("La fenêtre de réservation est fermée.");
  const monday = local.startOf("week");
  return {
    date: local.toISODate()!,
    from: monday.toUTC().toISO()!,
    to: monday.plus({ weeks: 1 }).toUTC().toISO()!,
  };
}
export function assertQuota(formule: string, quota: number, confirmed: number) {
  // Le kit attribue 7 à « illimite » : la formule prime sur cette valeur technique.
  if (formule !== "illimite" && confirmed >= quota)
    throw conflict("Le quota hebdomadaire est atteint.");
}
