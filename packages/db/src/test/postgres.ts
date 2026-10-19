// Vitest global setup: one throwaway Postgres for the whole run, migrated like production.
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { execFileSync } from "node:child_process";
import type { TestProject } from "vitest/node";

/** Same major version as infra/docker-compose.yml. */
const POSTGRES_IMAGE = "postgres:17.6-alpine";

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
  execFileSync("prisma", ["migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
  project.provide("databaseUrl", databaseUrl);

  return async () => {
    await container.stop();
  };
}
