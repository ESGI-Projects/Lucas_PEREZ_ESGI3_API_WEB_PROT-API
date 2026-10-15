import { z } from "zod";
import type { Request } from "express";

export const offsetFields = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
export type Page = { page: number; limit: number };
export function offsetResult(
  req: Request,
  data: unknown[],
  total: number,
  { page, limit }: Page,
) {
  const link = (number: number) => {
    const url = new URL(req.originalUrl, "http://local");
    url.searchParams.set("page", String(number));
    url.searchParams.set("limit", String(limit));
    return url.pathname + url.search;
  };
  return {
    data,
    pagination: { page, limit, total },
    links: {
      next: page * limit < total ? link(page + 1) : null,
      prev: page > 1 ? link(page - 1) : null,
    },
  };
}
