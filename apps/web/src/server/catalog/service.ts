import { createCatalogService, type CatalogService } from "@reanit/core/catalog";
import { createCatalogStore } from "@reanit/db";

import { getDb } from "../db";

/**
 * Wires one school's catalog use cases to Postgres through the tenant client.
 *
 * @param schoolId The school whose catalog to work on.
 * @returns The school's catalog service.
 * @throws {z.ZodError} When `DATABASE_URL` is missing or `schoolId` is not a UUID.
 */
export function getCatalogService(schoolId: string): CatalogService {
  return createCatalogService({ store: createCatalogStore(getDb(), schoolId) });
}
