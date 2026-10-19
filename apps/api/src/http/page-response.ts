import { z } from "zod";

/**
 * Builds the schema of a paged list response: one page of items under their own name, with the
 * total across pages and where this page is.
 *
 * @param key Name of the items field, e.g. "students".
 * @param item Schema of one item.
 * @returns The response schema.
 * @example
 * class StudentsResponse extends createZodDto(pageResponseSchema("students", studentSchema)) {}
 */
export function pageResponseSchema<Key extends string, Item extends z.ZodType>(key: Key, item: Item) {
  return z.object({
    ...({ [key]: z.array(item) } as Record<Key, z.ZodArray<Item>>),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });
}
