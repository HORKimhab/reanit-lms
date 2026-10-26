// Builds the real Nest app for tests, with the database and Redis replaced by fakes at the provider boundary.
import type { Type } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import type { AnalyticsService } from "@reanit/core/analytics";
import type { AuditLog } from "@reanit/core/audit";
import type { AccountService, AuthService } from "@reanit/core/auth";
import type { CatalogService } from "@reanit/core/catalog";
import type { CommerceService } from "@reanit/core/commerce";
import type { CertificateService, CommentModeration, LearningService } from "@reanit/core/learning";
import type { MediaService } from "@reanit/core/media";
import type { NotificationPreferenceService } from "@reanit/core/notifications";
import type { DomainService, SchoolService, StudentService } from "@reanit/core/schools";
import { PARAMS_PROVIDER_TOKEN } from "nestjs-pino";
import type { DestinationStream } from "pino";
import { afterEach, beforeEach, vi, type Mock } from "vitest";

import { ANALYTICS_FOR_SCHOOL } from "../analytics/analytics.tokens";
import { AppModule } from "../app.module";
import { AUDIT_FOR_SCHOOL } from "../audit/audit.tokens";
import { ACCOUNT_SERVICE, AUTH_SERVICE } from "../auth/auth.tokens";
import { CATALOG_FOR_SCHOOL } from "../catalog/catalog.tokens";
import { COMMERCE_FOR_SCHOOL, PAYMENT_CONFIRMATION } from "../commerce/commerce.tokens";
import { setupApp } from "../app.setup";
import { ENV } from "@reanit/nest";

import type { Env } from "../config/env";
import { createAdapter } from "../context/request-id";
import { DB_CLIENT } from "@reanit/nest";
import { loggerOptions } from "@reanit/nest";
import { CERTIFICATES_FOR_SCHOOL, COMMENT_MODERATION_FOR_SCHOOL, LEARNING_FOR_SCHOOL } from "../learning/learning.tokens";
import { MEDIA_FOR_SCHOOL } from "../media/media.tokens";
import { NOTIFICATION_PREFERENCES } from "../notifications/notifications.tokens";
import { REDIS } from "../redis/redis.module";
import { RATE_LIMIT_STORAGE, UNLIMITED_RATE } from "./rate-limit";
import { DOMAIN_SERVICE, SCHOOL_SERVICE, STUDENTS_FOR_SCHOOL } from "../schools/schools.tokens";

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
  STRIPE_SECRET_KEY: "sk_test_reanit",
  STRIPE_WEBHOOK_SECRET: "whsec_reanit_test",
  PAYWAY_BASE_URL: "https://payway.test",
  BAKONG_MERCHANT_NAME: "Reanit",
  BAKONG_MERCHANT_CITY: "Phnom Penh",
  BAKONG_BASE_URL: "https://bakong.test",
  FAKE_PAYMENTS: false,
  PORT: 4000,
  HOST: "127.0.0.1",
  TRUST_PROXY_HOPS: 0,
  LOG_LEVEL: "silent",
};

/** Fakes of the database and Redis clients and of the auth use cases, with spies tests can program and inspect. */
export type FakeClients = {
  db: { $queryRaw: Mock; $disconnect: Mock };
  redis: { status: string; ping: Mock; quit: Mock; disconnect: Mock };
  /** Stands in for `@reanit/core/auth`; every session is unknown until a test says otherwise. */
  auth: Record<keyof AuthService, Mock>;
  /** Stands in for the account data rights. */
  account: Record<keyof AccountService, Mock>;
  /** Stands in for `@reanit/core/schools`. */
  schools: Record<keyof SchoolService, Mock>;
  /** Stands in for the custom domain use cases. */
  domains: Record<keyof DomainService, Mock>;
  /** Stands in for every school's students list; `studentsFor` records which school was asked for. */
  students: Record<keyof StudentService, Mock>;
  studentsFor: Mock<(schoolId: string) => StudentService>;
  /** Stands in for every school's catalog; `catalogFor` records which school was asked for. */
  catalog: Record<keyof CatalogService, Mock>;
  catalogFor: Mock<(schoolId: string) => CatalogService>;
  /** Stands in for every school's media service; `mediaFor` records which school was asked for. */
  media: Record<keyof MediaService, Mock>;
  mediaFor: Mock<(schoolId: string) => MediaService>;
  /** Stands in for every school's commerce service; `commerceFor` records which school was asked for. */
  commerce: Record<keyof CommerceService, Mock>;
  commerceFor: Mock<(schoolId: string) => CommerceService>;
  /** Stands in for the payment confirmation that enrolls. */
  confirmation: { confirm: Mock };
  /** Stands in for every school's learning service; `learningFor` records which school was asked for. */
  learning: Record<keyof LearningService, Mock>;
  learningFor: Mock<(schoolId: string) => LearningService>;
  /** Stands in for every school's comment moderation; `moderationFor` records which school was asked for. */
  moderation: Record<keyof CommentModeration, Mock>;
  moderationFor: Mock<(schoolId: string) => CommentModeration>;
  /** Stands in for every school's certificate service; `certificatesFor` records which school was asked for. */
  certificates: Record<keyof CertificateService, Mock>;
  certificatesFor: Mock<(schoolId: string) => CertificateService>;
  /** Stands in for every school's stats service; `analyticsFor` records which school was asked for. */
  analytics: Record<keyof AnalyticsService, Mock>;
  analyticsFor: Mock<(schoolId: string) => AnalyticsService>;
  /** Stands in for every school's audit log; `auditFor` records which school was asked for. */
  audit: Record<keyof AuditLog, Mock>;
  auditFor: Mock<(schoolId: string) => AuditLog>;
  /** Stands in for the staff email settings. */
  notificationPreferences: Record<keyof NotificationPreferenceService, Mock>;
};

/** Extras a test can boot the app with. */
type TestAppOptions = {
  /** Test-only controllers mounted next to the app's own, e.g. to read the request context. */
  controllers?: Type[];
  /** Test-only modules, for probe controllers that need a feature module's providers. */
  imports?: Type[];
  /** Extra providers to replace, e.g. a gateway the test controls, or `RATE_LIMIT_STORAGE` to count requests for real. */
  overrides?: { provide: symbol; useValue: unknown }[];
  /** Receives the app's logs at `info` level; logging is silent otherwise. nestjs-pino keeps the first app's logger for the whole test file. */
  logStream?: DestinationStream;
};

/** Every use case of each core service; the `FakeClients` type fails the build when a service gains one missing here. */
const AUTH_METHODS = ["signUp", "logIn", "requestMagicLink", "verifyMagicLink", "getSessionUser", "logOut"] as const satisfies readonly (keyof AuthService)[];
const ACCOUNT_METHODS = ["exportData", "deleteAccount"] as const satisfies readonly (keyof AccountService)[];
const SCHOOL_METHODS = [
  "createSchool",
  "getSchoolBySubdomain",
  "getPublicSchool",
  "getStaffSchool",
  "requestLogoUpload",
  "updateSettings",
] as const satisfies readonly (keyof SchoolService)[];
const DOMAIN_METHODS = [
  "isAvailable",
  "getDomain",
  "addDomain",
  "verifyDomain",
  "removeDomain",
  "resolveHostname",
] as const satisfies readonly (keyof DomainService)[];
const STUDENT_METHODS = ["searchStudents"] as const satisfies readonly (keyof StudentService)[];
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
const COMMERCE_METHODS = [
  "setPrice",
  "createCoupon",
  "listCoupons",
  "deleteCoupon",
  "getOffer",
  "checkout",
  "listBundles",
  "getBundle",
  "getPublishedBundle",
  "createBundle",
  "updateBundle",
  "setBundlePrice",
  "getBundleOffer",
  "checkoutBundle",
  "getOrder",
] as const satisfies readonly (keyof CommerceService)[];
const LEARNING_METHODS = [
  "getCourse",
  "getLessonMedia",
  "recordProgress",
  "getQuizForEditing",
  "saveQuiz",
  "getQuiz",
  "submitQuiz",
  "listComments",
  "postComment",
  "deleteComment",
] as const satisfies readonly (keyof LearningService)[];
const MODERATION_METHODS = ["listInbox", "listLessonComments", "reply", "setHidden"] as const satisfies readonly (keyof CommentModeration)[];
const CERTIFICATE_METHODS = ["verifyCertificate", "getDownloadUrl", "getTemplate", "saveTemplate"] as const satisfies readonly (keyof CertificateService)[];
const ANALYTICS_METHODS = ["getCourseStats", "getSalesReport"] as const satisfies readonly (keyof AnalyticsService)[];
const AUDIT_METHODS = ["record", "listEntries"] as const satisfies readonly (keyof AuditLog)[];
const NOTIFICATION_PREFERENCE_METHODS = ["getPreferences", "savePreferences", "unsubscribe"] as const satisfies readonly (keyof NotificationPreferenceService)[];

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
 * @returns A fake Prisma client, Redis connection, and auth, account, school, domain, students, catalog, media, commerce, learning, moderation, certificate, stats, audit and email settings services.
 */
export function createFakeClients(): FakeClients {
  const auth = fakeService(AUTH_METHODS);
  auth.getSessionUser.mockResolvedValue(null);
  const catalog = fakeService(CATALOG_METHODS);
  const media = fakeService(MEDIA_METHODS);
  const commerce = fakeService(COMMERCE_METHODS);
  const learning = fakeService(LEARNING_METHODS);
  const moderation = fakeService(MODERATION_METHODS);
  const certificates = fakeService(CERTIFICATE_METHODS);
  const analytics = fakeService(ANALYTICS_METHODS);
  const students = fakeService(STUDENT_METHODS);
  const audit = fakeService(AUDIT_METHODS);
  return {
    db: { $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]), $disconnect: vi.fn() },
    redis: { status: "ready", ping: vi.fn().mockResolvedValue("PONG"), quit: vi.fn(), disconnect: vi.fn() },
    auth,
    account: fakeService(ACCOUNT_METHODS),
    schools: fakeService(SCHOOL_METHODS),
    domains: fakeService(DOMAIN_METHODS),
    students,
    studentsFor: vi.fn(() => students as unknown as StudentService),
    catalog,
    catalogFor: vi.fn(() => catalog as unknown as CatalogService),
    media,
    mediaFor: vi.fn(() => media as unknown as MediaService),
    commerce,
    commerceFor: vi.fn(() => commerce as unknown as CommerceService),
    confirmation: { confirm: vi.fn() },
    learning,
    learningFor: vi.fn(() => learning as unknown as LearningService),
    moderation,
    moderationFor: vi.fn(() => moderation as unknown as CommentModeration),
    certificates,
    certificatesFor: vi.fn(() => certificates as unknown as CertificateService),
    analytics,
    analyticsFor: vi.fn(() => analytics as unknown as AnalyticsService),
    audit,
    auditFor: vi.fn(() => audit as unknown as AuditLog),
    notificationPreferences: fakeService(NOTIFICATION_PREFERENCE_METHODS),
  };
}

/**
 * Boots the app on Fastify, set up as `main.ts` does, without listening; send requests with `app.inject`.
 *
 * @param clients Fakes from `createFakeClients`.
 * @param options Extra controllers, modules, provider overrides and a log destination.
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
    .overrideProvider(RATE_LIMIT_STORAGE)
    .useValue(UNLIMITED_RATE)
    .overrideProvider(AUTH_SERVICE)
    .useValue(clients.auth)
    .overrideProvider(ACCOUNT_SERVICE)
    .useValue(clients.account)
    .overrideProvider(SCHOOL_SERVICE)
    .useValue(clients.schools)
    .overrideProvider(DOMAIN_SERVICE)
    .useValue(clients.domains)
    .overrideProvider(STUDENTS_FOR_SCHOOL)
    .useValue(clients.studentsFor)
    .overrideProvider(CATALOG_FOR_SCHOOL)
    .useValue(clients.catalogFor)
    .overrideProvider(MEDIA_FOR_SCHOOL)
    .useValue(clients.mediaFor)
    .overrideProvider(COMMERCE_FOR_SCHOOL)
    .useValue(clients.commerceFor)
    .overrideProvider(PAYMENT_CONFIRMATION)
    .useValue(clients.confirmation)
    .overrideProvider(LEARNING_FOR_SCHOOL)
    .useValue(clients.learningFor)
    .overrideProvider(COMMENT_MODERATION_FOR_SCHOOL)
    .useValue(clients.moderationFor)
    .overrideProvider(CERTIFICATES_FOR_SCHOOL)
    .useValue(clients.certificatesFor)
    .overrideProvider(ANALYTICS_FOR_SCHOOL)
    .useValue(clients.analyticsFor)
    .overrideProvider(AUDIT_FOR_SCHOOL)
    .useValue(clients.auditFor)
    .overrideProvider(NOTIFICATION_PREFERENCES)
    .useValue(clients.notificationPreferences);
  for (const { provide, useValue } of options.overrides ?? []) builder = builder.overrideProvider(provide).useValue(useValue);
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
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createAdapter(), { bufferLogs: true, rawBody: true });
  await setupApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

/** A test app and its fakes; the fields are replaced before each test. */
export type TestApp = { clients: FakeClients; app: NestFastifyApplication };

/**
 * Boots a fresh app before each test and closes it after.
 *
 * @param prepare Programs the fakes before the app boots, e.g. to resolve a school.
 * @param options Extras to boot each app with, made fresh for each test.
 * @returns An object whose fields are replaced before each test: read them inside tests, never destructure at file level.
 */
export function useTestApp(prepare?: (clients: FakeClients) => void, options?: () => TestAppOptions): TestApp {
  const testApp = {} as TestApp;
  beforeEach(async () => {
    const clients = createFakeClients();
    prepare?.(clients);
    Object.assign(testApp, { clients, app: await createTestApp(clients, options?.()) });
  });
  afterEach(async () => {
    await testApp.app.close();
  });
  return testApp;
}
