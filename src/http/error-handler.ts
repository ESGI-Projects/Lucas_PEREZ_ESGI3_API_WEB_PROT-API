import type { ErrorRequestHandler } from "express";
import { AppError } from "./errors.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  _next,
) => {
  let problem = error instanceof AppError ? error : undefined;
  const failure = error as { code?: string; type?: string; status?: number };
  if (!problem && failure.type === "entity.parse.failed")
    problem = new AppError(
      400,
      "json-invalide",
      "JSON illisible",
      "Vérifiez la syntaxe du corps JSON.",
    );
  if (!problem && failure.status === 413)
    problem = new AppError(
      413,
      "corps-volumineux",
      "Corps trop volumineux",
      "La limite est de 100 ko.",
    );
  if (
    !problem &&
    failure.status &&
    failure.status >= 400 &&
    failure.status < 500
  )
    problem = new AppError(
      failure.status,
      "requete-invalide",
      "Requête invalide",
      "Le corps ne peut pas être lu.",
    );
  if (
    !problem &&
    ["23505", "23503", "23514", "23P01"].includes(failure.code ?? "")
  )
    problem = new AppError(
      409,
      "contrainte",
      "Conflit avec les données",
      "Cette opération entre en conflit avec les données existantes.",
    );
  if (!problem) {
    console.error("Erreur interne", error);
    problem = new AppError(
      500,
      "interne",
      "Erreur interne",
      "Une erreur inattendue est survenue.",
    );
  }
  if (problem.status === 503) res.set("Retry-After", "1");
  res
    .status(problem.status)
    .type("application/problem+json")
    .json({
      type: `urn:salle-de-sport:problem:${problem.category}`,
      title: problem.title,
      status: problem.status,
      detail: problem.message,
      instance: req.originalUrl,
      ...(problem.errors ? { errors: problem.errors } : {}),
    });
};
