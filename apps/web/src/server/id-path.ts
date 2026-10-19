import { notFound } from "next/navigation";
import { z } from "zod";

const idSchema = z.uuid();

/**
 * Checks an id from the browser before it goes into an API path such as `/courses/{id}`.
 *
 * @param id Untrusted id.
 * @returns The id, as the path parameter the API expects.
 * @throws {Error} Next's not-found signal when it is not a UUID.
 */
export function idPath(id: unknown): { path: { id: string } } {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) notFound();
  return { path: { id: parsed.data } };
}
