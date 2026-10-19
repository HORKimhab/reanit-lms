// Builds the real Nest app for tests, with the database and Redis replaced by fakes at the provider boundary.
import type { Type } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { PARAMS_PROVIDER_TOKEN } from "nestjs-pino";
import type { DestinationStream } from "pino";
import { vi, type Mock } from "vitest";

import { AppModule } from "../app.module";
import { setupApp } from "../app.setup";
import { ENV, type Env } from "../config/env";
import { createAdapter } from "../context/request-id";
import { DB_CLIENT } from "../db/db.module";
import { loggerOptions } from "../logging/logger-options";
import { REDIS } from "../redis/redis.module";

/** Environment the test app boots with; nothing connects to these URLs. */
const TEST_ENV: Env = {
  DATABASE_URL: "postgresql://reanit:reanit@localhost:5432/reanit",
  REDIS_URL: "redis://localhost:6379",
  PORT: 4000,
  HOST: "127.0.0.1",
  LOG_LEVEL: "silent",
};

/** Fakes of the database and Redis clients, with spies tests can program and inspect. */
export type FakeClients = {
  db: { $queryRaw: Mock; $disconnect: Mock };
  redis: { status: string; ping: Mock; quit: Mock; disconnect: Mock };
};

/** Extras a test can boot the app with. */
type TestAppOptions = {
  /** Test-only controllers mounted next to the app's own, e.g. to read the request context. */
  controllers?: Type[];
  /** Receives the app's logs at `info` level; logging is silent otherwise. nestjs-pino keeps the first app's logger for the whole test file. */
  logStream?: DestinationStream;
};

/**
 * Creates fakes for the clients the app holds; both answer until a test says otherwise.
 *
 * @returns A fake Prisma client and a fake Redis connection.
 */
export function createFakeClients(): FakeClients {
  return {
    db: { $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]), $disconnect: vi.fn() },
    redis: { status: "ready", ping: vi.fn().mockResolvedValue("PONG"), quit: vi.fn(), disconnect: vi.fn() },
  };
}

/**
 * Boots the app on Fastify, set up as `main.ts` does, without listening; send requests with `app.inject`.
 *
 * @param clients Fakes from `createFakeClients`.
 * @param options Extra controllers and a log destination.
 * @returns The initialized app. Close it after the test.
 */
export async function createTestApp(
  clients: FakeClients = createFakeClients(),
  options: TestAppOptions = {},
): Promise<NestFastifyApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule], controllers: options.controllers ?? [] })
    .overrideProvider(ENV)
    .useValue(TEST_ENV)
    .overrideProvider(DB_CLIENT)
    .useValue(clients.db)
    .overrideProvider(REDIS)
    .useValue(clients.redis);
  if (options.logStream) {
    const logged = loggerOptions({ ...TEST_ENV, LOG_LEVEL: "info" });
    builder = builder.overrideProvider(PARAMS_PROVIDER_TOKEN).useValue({ pinoHttp: [logged, options.logStream] });
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createAdapter(), { bufferLogs: true });
  await setupApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
