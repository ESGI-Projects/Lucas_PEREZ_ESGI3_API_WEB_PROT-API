import { z } from "zod";
import { idSchema } from "../../http/validation.js";
import { offsetFields } from "../../http/pagination.js";
export const reservationInput = z.strictObject({
  adherent_id: z.number().int().positive().max(2147483647),
});
export const annulationInput = z.strictObject({ statut: z.literal("annulee") });
export const historiqueQuery = z
  .strictObject({
    page: z.coerce.number().int().min(1).max(100000).optional(),
    limit: offsetFields.limit,
    after: z.string().max(512).optional(),
    adherent: idSchema.optional(),
    creneau: idSchema.optional(),
  })
  .refine((v) => !(v.page && v.after), {
    path: ["after"],
    message: "Choisir page ou after, pas les deux.",
  });
export const attenteQuery = z.strictObject({
  ...offsetFields,
  creneau: idSchema.optional(),
});
export const cursorSchema = z.strictObject({
  time: z.iso.datetime({ offset: true }),
  id: z.number().int().positive(),
});
export type Cursor = z.infer<typeof cursorSchema>;
export type HistoriqueQuery = z.infer<typeof historiqueQuery>;
export type AttenteQuery = z.infer<typeof attenteQuery>;
export type Reservation = {
  id: number;
  creneau_id: number;
  adherent_id: number;
  statut: "confirmee" | "en_attente" | "annulee" | "retiree";
  cree_le: string;
  motif: string | null;
};
export type Waiting = Reservation & { rang: number | null };
