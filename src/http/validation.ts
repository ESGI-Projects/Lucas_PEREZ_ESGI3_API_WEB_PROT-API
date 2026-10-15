import { z } from "zod";
import { AppError } from "./errors.js";

export function parse<T extends z.ZodType>(
  schema: T,
  value: unknown,
  status = 422,
): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(
      status,
      "validation",
      "Requête invalide",
      "Corrigez les champs indiqués.",
      result.error.issues.map((issue) => ({
        field: issue.path.join(".") || "$",
        message: issue.message,
      })),
    );
  return result.data;
}
export const idSchema = z.coerce.number().int().positive().max(2147483647);
export const parseId = (value: unknown) => parse(idSchema, value, 400);
export const nonEmptyPatch = <T extends z.ZodRawShape>(shape: T) =>
  z
    .strictObject(shape)
    .partial()
    .refine(
      (value) => Object.keys(value).length > 0,
      "Fournir au moins un champ.",
    );
