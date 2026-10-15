import { AppError } from "./errors.js";

export const courseEtag = (row: { id: number; version: number }) =>
  `"cours-${row.id}-v${row.version}"`;
export function matchesRead(header: string | undefined, tag: string) {
  return (
    header
      ?.split(",")
      .some(
        (value) =>
          value.trim() === "*" || value.trim().replace(/^W\//, "") === tag,
      ) ?? false
  );
}
export function checkIfMatch(header: string | undefined, tag: string) {
  if (header === undefined) return;
  if (
    !header
      .split(",")
      .some((value) => value.trim() === "*" || value.trim() === tag)
  )
    throw new AppError(
      412,
      "precondition",
      "Précondition échouée",
      "Le cours a changé. Relisez-le avant de le modifier.",
    );
}
