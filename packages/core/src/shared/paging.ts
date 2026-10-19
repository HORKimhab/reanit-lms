import { z } from "zod";

/** A list query's 1-based page, read from a query string. */
export const pageSchema = z.coerce.number().int().min(1).default(1);

/**
 * Turns a 1-based page into the rows a store skips and returns.
 *
 * @param page The page.
 * @param pageSize Rows per page.
 * @returns The limit and offset.
 */
export function pageWindow(page: number, pageSize: number): { limit: number; offset: number } {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}
