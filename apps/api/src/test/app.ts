// Builds the real Nest app for tests, with the database and Redis replaced by fakes at the provider boundary.
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { vi, type Mock } from "vitest";

import { AppModule } from "../app.module";
import { ENV, type Env } from "../config/env";
import { DB_CLIENT } from "../db/db.module";
import { REDIS } from "../redis/redis.module";

/** Environment the test app boots with; nothing connects to these URLs. */
const TEST_ENV: Env = {
  DATABASE_URL: "postgresql://reanit:reanit@localhost:5432/reanit",
  REDIS_URL: "redis://localhost:6379",
  PORT: 4000,
  HOST: "127.0.0.1",
};

/** Fakes of the database and Redis clients, with spies tests can program and inspect. */
export type FakeClients = {
  db: { $queryRaw: Mock; $disconnect: Mock };
  redis: { ping: Mock; quit: Mock };
};

/**
 * Creates fakes for the clients the app holds; both answer until a test says otherwise.
 *
 * @returns A fake Prisma client and a fake Redis connection.
 */
export function createFakeClients(): FakeClients {
  return {
    db: { $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]), $disconnect: vi.fn() },
    redis: { ping: vi.fn().mockResolvedValue("PONG"), quit: vi.fn() },
  };
}

/**
 * Boots the app on Fastify without listening; send requests with `app.inject`.
 *
 * @param clients Fakes from `createFakeClients`.
 * @returns The initialized app. Close it after the test.
 */
export async function createTestApp(clients: FakeClients): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue(TEST_ENV)
    .overrideProvider(DB_CLIENT)
    .useValue(clients.db)
    .overrideProvider(REDIS)
    .useValue(clients.redis)
    .compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
