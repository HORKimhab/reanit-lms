// Vitest global setup: one throwaway Postgres for the whole run, migrated like production.
// Exported as `@reanit/db/testing/postgres` for other packages' integration tests (e.g. apps/api e2e).
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { TestProject } from "vitest/node";

/** Same major version as infra/docker-compose.yml. */
const POSTGRES_IMAGE = "postgres:17.6-alpine";

/** packages/db, where prisma.config.ts and the migrations live, whichever package runs the tests. */
const DB_PACKAGE_DIR = fileURLToPath(new URL("../..", import.meta.url));

declare module "vitest" {
  export interface ProvidedContext {
    /** Owner (superuser) connection to the migrated test database. */
    databaseUrl: string;
  }
}

/**
 * Starts Postgres in Docker, applies every migration and hands its URL to the tests.
 *
 * @param project Vitest project, used to `provide` the database URL.
 * @returns Teardown that stops the container.
 * @throws {Error} When Docker is unavailable or a migration fails.
 */
export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const databaseUrl = container.getConnectionUri();
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: DB_PACKAGE_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
  project.provide("databaseUrl", databaseUrl);

  return async () => {
    await container.stop();
  };
}
