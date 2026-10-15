import { z } from "zod";
import { nonEmptyPatch } from "../../http/validation.js";
import { offsetFields } from "../../http/pagination.js";
const fields = {
  nom: z.string().trim().min(1).max(100),
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
};
export const adherentInput = z.strictObject(fields);
export const adherentPatch = nonEmptyPatch(fields);
export const adherentsQuery = z.strictObject(offsetFields);
export type AdherentInput = z.infer<typeof adherentInput>;
export type Adherent = AdherentInput & { id: number };
