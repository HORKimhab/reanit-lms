import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

/** Unscoped Prisma client. Only `forSchool` and migrations/seeds should hold one. */
export type DbClient = PrismaClient;

/**
 * Opens a Prisma client over node-postgres. Queries on it are not tenant-scoped,
 * so app code wraps it with `forSchool` before touching tenant tables.
 *
 * @param databaseUrl Postgres connection string.
 * @returns A Prisma client; call `$disconnect()` when done.
 * @example
 * const db = createDbClient(env.DATABASE_URL);
 */
export function createDbClient(databaseUrl: string): DbClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}
