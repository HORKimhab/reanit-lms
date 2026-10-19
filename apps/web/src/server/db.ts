import { createDbClient, type DbClient } from "@reanit/db";

import { getServerEnv } from "./env";

// Survives dev hot reloads, which would otherwise open a new pool on every edit.
const globalForDb = globalThis as typeof globalThis & { reanitDb?: DbClient };

/**
 * Returns the process-wide database client. Wrap it with `forSchool` for tenant data.
 *
 * @returns The shared unscoped client.
 * @throws {z.ZodError} When `DATABASE_URL` is missing.
 */
export function getDb(): DbClient {
  globalForDb.reanitDb ??= createDbClient(getServerEnv().DATABASE_URL);
  return globalForDb.reanitDb;
}
