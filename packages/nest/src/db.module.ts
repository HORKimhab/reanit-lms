import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { createDbClient, type DbClient } from "@reanit/db";

import { ENV, type BaseEnv } from "./env";

/** Injection token for the process-wide, unscoped Prisma client. Wrap it with `forSchool` for tenant data. */
export const DB_CLIENT = Symbol("DB_CLIENT");

/**
 * Opens the shared client; the pool connects on the first query.
 *
 * @param env Validated environment.
 * @returns The client.
 */
function openDb(env: BaseEnv) {
  return createDbClient(env.DATABASE_URL);
}

/** Provides one database client to every module and closes its pool on shutdown. */
@Global()
@Module({
  providers: [{ provide: DB_CLIENT, inject: [ENV], useFactory: openDb }],
  exports: [DB_CLIENT],
})
export class DbModule implements OnApplicationShutdown {
  /**
   * Receives the client so it can be closed on shutdown.
   *
   * @param db The shared client.
   */
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  /** Closes the connection pool. */
  async onApplicationShutdown() {
    await this.db.$disconnect();
  }
}
