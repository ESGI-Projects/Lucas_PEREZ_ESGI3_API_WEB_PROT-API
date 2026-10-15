import { z } from "zod";
import { nonEmptyPatch } from "../../http/validation.js";
import { offsetFields } from "../../http/pagination.js";
const fields = {
  type: z.string().trim().min(1).max(50),
  coach_id: z.number().int().positive().max(2147483647),
  capacite: z.number().int().min(1).max(1000),
  jour_semaine: z.number().int().min(1).max(7),
  heure_debut: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, "Heure attendue HH:mm."),
  duree_min: z.number().int().min(1).max(1440),
  periode_debut: z.iso.date(),
  periode_fin: z.iso.date(),
  fuseau: z.literal("Europe/Paris"),
};
export const courseFields = z.strictObject(fields);
export const coursInput = courseFields.refine(
  (v) => v.periode_fin >= v.periode_debut,
  { path: ["periode_fin"], message: "La fin précède le début." },
);
export const coursPatch = nonEmptyPatch(fields);
export const coursQuery = z.strictObject(offsetFields);
export type CoursInput = z.infer<typeof coursInput>;
export type Cours = CoursInput & { id: number; version: number };
