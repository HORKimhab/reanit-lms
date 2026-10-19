// Builds the real Nest app for tests, with the database and Redis replaced by fakes at the provider boundary.
import type { Type } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import type { AuthService } from "@reanit/core/auth";
import type { CatalogService } from "@reanit/core/catalog";
import type { MediaService } from "@reanit/core/media";
import type { SchoolService } from "@reanit/core/schools";
import { PARAMS_PROVIDER_TOKEN } from "nestjs-pino";
import type { DestinationStream } from "pino";
import { vi, type Mock } from "vitest";

import { AppModule } from "../app.module";
import { AUTH_SERVICE } from "../auth/auth.tokens";
import { CATALOG_FOR_SCHOOL } from "../catalog/catalog.tokens";
import { setupApp } from "../app.setup";
import { ENV } from "@reanit/nest";

import type { Env } from "../config/env";
import { createAdapter } from "../context/request-id";
import { DB_CLIENT } from "@reanit/nest";
import { loggerOptions } from "@reanit/nest";
import { MEDIA_FOR_SCHOOL } from "../media/media.tokens";
import { REDIS } from "../redis/redis.module";
import { SCHOOL_SERVICE } from "../schools/schools.tokens";

/** Environment the test app boots with; nothing connects to these URLs (e2e tests swap in a real database). */
export const TEST_ENV: Env = {
  DATABASE_URL: "postgresql://reanit:reanit@localhost:5432/reanit",
  REDIS_URL: "redis://localhost:6379",
  APP_URL: "http://localhost:3000",
  SMTP_URL: "smtp://localhost:1025",
  MAIL_FROM: "Reanit <no-reply@reanit.localhost>",
  S3_ENDPOINT: "http://storage.test",
  S3_REGION: "auto",
  S3_BUCKET: "reanit-media",
  S3_ACCESS_KEY_ID: "test-key",
  S3_SECRET_ACCESS_KEY: "test-secret",
  S3_FORCE_PATH_STYLE: true,
  PORT: 4000,
  HOST: "127.0.0.1",
  LOG_LEVEL: "silent",
};

/** Fakes of the database and Redis clients and of the auth use cases, with spies tests can program and inspect. */
export type FakeClients = {
  db: { $queryRaw: Mock; $disconnect: Mock };
  redis: { status: string; ping: Mock; quit: Mock; disconnect: Mock };
  /** Stands in for `@reanit/core/auth`; every session is unknown until a test says otherwise. */
  auth: Record<keyof AuthService, Mock>;
  /** Stands in for `@reanit/core/schools`. */
  schools: Record<keyof SchoolService, Mock>;
  /** Stands in for every school's catalog; `catalogFor` records which school was asked for. */
  catalog: Record<keyof CatalogService, Mock>;
  catalogFor: Mock<(schoolId: string) => CatalogService>;
  /** Stands in for every school's media service; `mediaFor` records which school was asked for. */
  media: Record<keyof MediaService, Mock>;
  mediaFor: Mock<(schoolId: string) => MediaService>;
};

/** Extras a test can boot the app with. */
type TestAppOptions = {
  /** Test-only controllers mounted next to the app's own, e.g. to read the request context. */
  controllers?: Type[];
  /** Test-only modules, for probe controllers that need a feature module's providers. */
  imports?: Type[];
  /** Receives the app's logs at `info` level; logging is silent otherwise. nestjs-pino keeps the first app's logger for the whole test file. */
  logStream?: DestinationStream;
};

/** Every use case of each core service; the `FakeClients` type fails the build when a service gains one missing here. */
const AUTH_METHODS = ["signUp", "logIn", "requestMagicLink", "verifyMagicLink", "getSessionUser", "logOut"] as const satisfies readonly (keyof AuthService)[];
const SCHOOL_METHODS = ["createSchool", "getSchoolBySubdomain", "getPublicSchool", "getStaffSchool"] as const satisfies readonly (keyof SchoolService)[];
const CATALOG_METHODS = [
  "listCourses",
  "getCourse",
  "listPublishedCourses",
  "getPublishedCourse",
  "createCourse",
  "updateCourse",
  "deleteCourse",
  "saveOutline",
] as const satisfies readonly (keyof CatalogService)[];
const MEDIA_METHODS = ["requestUpload", "attachMedia", "getPlaybackUrl"] as const satisfies readonly (keyof MediaService)[];

/**
 * Creates a fake of a core service with one spy per use case.
 *
 * @param methods The service's use cases.
 * @returns Spies keyed by use case.
 */
function fakeService<Method extends string>(methods: readonly Method[]): Record<Method, Mock> {
  return Object.fromEntries(methods.map((method) => [method, vi.fn()])) as Record<Method, Mock>;
}

/**
 * Creates fakes for the clients the app holds; they answer until a test says otherwise.
 *
 * @returns A fake Prisma client, Redis connection, and auth, school, catalog and media services.
 */
export function createFakeClients(): FakeClients {
  const auth = fakeService(AUTH_METHODS);
  auth.getSessionUser.mockResolvedValue(null);
  const catalog = fakeService(CATALOG_METHODS);
  const media = fakeService(MEDIA_METHODS);
  return {
    db: { $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]), $disconnect: vi.fn() },
    redis: { status: "ready", ping: vi.fn().mockResolvedValue("PONG"), quit: vi.fn(), disconnect: vi.fn() },
    auth,
    schools: fakeService(SCHOOL_METHODS),
    catalog,
    catalogFor: vi.fn(() => catalog as unknown as CatalogService),
    media,
    mediaFor: vi.fn(() => media as unknown as MediaService),
  };
}

/**
 * Boots the app on Fastify, set up as `main.ts` does, without listening; send requests with `app.inject`.
 *
 * @param clients Fakes from `createFakeClients`.
 * @param options Extra controllers, modules and a log destination.
 * @returns The initialized app. Close it after the test.
 */
export async function createTestApp(
  clients: FakeClients = createFakeClients(),
  options: TestAppOptions = {},
): Promise<NestFastifyApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule, ...(options.imports ?? [])], controllers: options.controllers ?? [] })
    .overrideProvider(ENV)
    .useValue(TEST_ENV)
    .overrideProvider(DB_CLIENT)
    .useValue(clients.db)
    .overrideProvider(REDIS)
    .useValue(clients.redis)
    .overrideProvider(AUTH_SERVICE)
    .useValue(clients.auth)
    .overrideProvider(SCHOOL_SERVICE)
    .useValue(clients.schools)
    .overrideProvider(CATALOG_FOR_SCHOOL)
    .useValue(clients.catalogFor)
    .overrideProvider(MEDIA_FOR_SCHOOL)
    .useValue(clients.mediaFor);
  if (options.logStream) {
    const logged = loggerOptions({ ...TEST_ENV, LOG_LEVEL: "info" });
    builder = builder.overrideProvider(PARAMS_PROVIDER_TOKEN).useValue({ pinoHttp: [logged, options.logStream] });
  }
  return bootTestApp(builder);
}

/**
 * Compiles a testing module and boots it on Fastify, set up as `main.ts` does, without listening.
 *
 * @param builder The testing module, with its overrides.
 * @returns The initialized app. Close it after the test.
 */
export async function bootTestApp(builder: TestingModuleBuilder): Promise<NestFastifyApplication> {
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createAdapter(), { bufferLogs: true });
  await setupApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
