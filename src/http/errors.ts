export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly category: string,
    public readonly title: string,
    detail: string,
    public readonly errors?: { field: string; message: string }[],
  ) {
    super(detail);
  }
}
export const notFound = (resource: string) =>
  new AppError(
    404,
    "introuvable",
    "Ressource introuvable",
    `${resource} introuvable.`,
  );
export const conflict = (detail: string) =>
  new AppError(409, "conflit", "Conflit métier", detail);
