import { z } from "zod";
import { offsetFields } from "../../http/pagination.js";
import { idSchema } from "../../http/validation.js";
const instant = z.iso.datetime({ offset: true });
export const creneauInput = z
  .strictObject({ debut: instant, fin: instant })
  .refine((v) => Date.parse(v.fin) > Date.parse(v.debut), {
    path: ["fin"],
    message: "La fin doit suivre le début.",
  });
export const planningQuery = z
  .strictObject({
    ...offsetFields,
    cours: idSchema.optional(),
    coach: idSchema.optional(),
    jour: z.iso.date().optional(),
    from: instant.optional(),
    to: instant.optional(),
    tri: z.enum(["debut,id", "fin,id", "id"]).default("debut,id"),
    ordre: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine((v) => !v.from || !v.to || Date.parse(v.to) > Date.parse(v.from), {
    path: ["to"],
    message: "La fin doit suivre le début.",
  });
export type PlanningQuery = z.infer<typeof planningQuery>;
export type CreneauInput = z.infer<typeof creneauInput>;
export type Creneau = {
  id: number;
  cours_id: number;
  debut: string;
  fin: string;
  capacite: number;
  places_prises: number;
  places_restantes: number;
};
