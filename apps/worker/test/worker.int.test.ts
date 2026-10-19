import { getSharedConfigToken } from "@nestjs/bullmq";
import { Test, type TestingModule } from "@nestjs/testing";
import type { MailMessage } from "@reanit/core/auth";
import type { EventHandlers } from "@reanit/core/events";
import {
  createCatalogStore,
  createCommerceStore,
  createDbClient,
  createPaymentConfirmationStore,
  createSchoolStore,
} from "@reanit/db";
// Types `inject("databaseUrl")`.
import type {} from "@reanit/db/testing/postgres";
import { DB_CLIENT, ENV, MAILER } from "@reanit/nest";
import { Queue } from "bullmq";
import { afterAll, afterEach, beforeAll, describe, expect, inject, it, vi } from "vitest";

import type { DeadLetter } from "../src/events/events.processor";
import { EVENT_HANDLERS, EVENT_JOB_OPTIONS, EVENTS_DEAD_LETTER_QUEUE } from "../src/events/events.tokens";
import { parseWorkerEnv, WorkerModule } from "../src/worker.module";

/** Two quick attempts, so a failing job is dead-lettered within the test. */
const FAST_RETRIES = { attempts: 2, backoff: { type: "fixed", delay: 10 } };
/** Longest wait for the worker to relay and run an event. */
const EVENT_TIMEOUT_MS = 10_000;

const db = createDbClient(inject("databaseUrl"));
/** The worker's environment: the test containers, and Mailpit-like mail settings that the fake mailer never uses. */
const WORKER_ENV = parseWorkerEnv({
  DATABASE_URL: inject("databaseUrl"),
  REDIS_URL: inject("redisUrl"),
  APP_URL: "https://reanit.test",
  SMTP_URL: "smtp://localhost:1025",
  MAIL_FROM: "Reanit <no-reply@reanit.test>",
  LOG_LEVEL: "silent",
});
let schoolId: string;
let worker: TestingModule | undefined;

/**
 * Boots the worker on the test Postgres and Redis, recording email instead of sending it.
 *
 * @param handlers What to run for each event type; the worker's own when left out.
 * @returns The running worker and the emails it sent.
 */
async function bootWorker(handlers?: EventHandlers) {
  const sent: MailMessage[] = [];
  const mailer = {
    /**
     * Records a message instead of sending it.
     *
     * @param message The email.
     */
    async send(message: MailMessage) {
      sent.push(message);
    },
  };
  let builder = Test.createTestingModule({ imports: [WorkerModule] })
    .overrideProvider(ENV)
    .useValue(WORKER_ENV)
    .overrideProvider(MAILER)
    .useValue(mailer)
    .overrideProvider(EVENT_JOB_OPTIONS)
    .useValue(FAST_RETRIES);
  if (handlers) builder = builder.overrideProvider(EVENT_HANDLERS).useValue(handlers);
  worker = await builder.compile();
  await worker.init();
  return { app: worker, sent };
}

/**
 * Writes a pending `CourseCompleted` event to the outbox, as the learning store does when a course is completed.
 *
 * @param courseId Course id to put in the payload.
 */
async function completeCourse(courseId: string) {
  await db.outboxEvent.create({ data: { schoolId, type: "CourseCompleted", payload: { enrollmentId: "e-1", courseId } } });
}

beforeAll(async () => {
  const owner = await db.user.create({ data: { email: "worker-owner@example.com" } });
  schoolId = (await createSchoolStore(db).createSchoolWithOwner({ name: "Worker", subdomain: "worker-school", ownerId: owner.id })).id;
});

afterEach(async () => {
  await worker?.close();
  worker = undefined;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("worker", () => {
  it("boots with BullMQ configured from the environment", async () => {
    const { app } = await bootWorker({});

    expect(app.get(getSharedConfigToken())).toMatchObject({ connection: { url: inject("redisUrl") } });
  });

  it("relays an outbox event to its handler and marks it published", async () => {
    const completed = vi.fn<NonNullable<EventHandlers["CourseCompleted"]>>().mockResolvedValue(undefined);
    await bootWorker({ CourseCompleted: completed });

    await completeCourse("relayed");

    await vi.waitFor(() => expect(completed).toHaveBeenCalledWith(expect.objectContaining({ schoolId, payload: { enrollmentId: "e-1", courseId: "relayed" } })), {
      timeout: EVENT_TIMEOUT_MS,
    });
    expect(completed.mock.lastCall?.[0].occurredAt).toBeInstanceOf(Date);
    expect(await db.outboxEvent.count({ where: { schoolId, publishedAt: null } })).toBe(0);
  });

  it("dead-letters a job whose handler fails every attempt", async () => {
    const failing = vi.fn<NonNullable<EventHandlers["CourseCompleted"]>>().mockRejectedValue(new Error("certificate service down"));
    await bootWorker({ CourseCompleted: failing });
    const deadLetters = new Queue<DeadLetter>(EVENTS_DEAD_LETTER_QUEUE, { connection: { url: inject("redisUrl") } });

    await completeCourse("doomed");

    try {
      const letter = await vi.waitFor(
        async () => {
          const [job] = (await deadLetters.getWaiting()).filter((waiting) => waiting.data.event.type === "CourseCompleted" && waiting.data.event.payload.courseId === "doomed");
          if (!job) throw new Error("Not dead-lettered yet");
          return job;
        },
        { timeout: EVENT_TIMEOUT_MS },
      );
      expect(letter.data).toMatchObject({ error: "certificate service down", attemptsMade: FAST_RETRIES.attempts, event: { type: "CourseCompleted", schoolId } });
      expect(failing).toHaveBeenCalledTimes(FAST_RETRIES.attempts);
    } finally {
      await deadLetters.close();
    }
  });

  it("emails a paid order's buyer a receipt and a welcome to the course, in the language they bought in", async () => {
    const { sent } = await bootWorker();
    const catalog = createCatalogStore(db, schoolId);
    const courseId = (await catalog.createCourse({ title: "Brand", slug: "brand" })).id;
    await catalog.updateCourse(courseId, { status: "published" });
    const commerce = createCommerceStore(db, schoolId);
    const price = await commerce.setPrice(courseId, { amount: 4900, currency: "USD" });
    const buyer = await db.user.create({ data: { email: "worker-buyer@example.com", name: "Sokha" } });
    // setPrice found the course it just created.
    const { id } = await commerce.createOrder({ userId: buyer.id, courseId, price: price!, method: "stripe", locale: "km" });
    await commerce.setProviderRef(id, `cs_worker_${id}`);

    await createPaymentConfirmationStore(db).confirm("stripe", `cs_worker_${id}`);

    await vi.waitFor(() => expect(sent).toHaveLength(2), { timeout: EVENT_TIMEOUT_MS });
    expect(sent.map(({ to, subject }) => ({ to, subject }))).toEqual([
      { to: "worker-buyer@example.com", subject: "បង្កាន់ដៃរបស់អ្នកពី Worker" },
      { to: "worker-buyer@example.com", subject: "សូមស្វាគមន៍មកកាន់ Brand" },
    ]);
    expect(sent[1]?.html).toContain('href="https://reanit.test/km/s/worker-school/learn/brand"');
  });

  it("closes the database pool on shutdown", async () => {
    const disconnect = vi.fn();
    worker = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(ENV)
      .useValue(WORKER_ENV)
      .overrideProvider(DB_CLIENT)
      .useValue({ $disconnect: disconnect, $transaction: vi.fn().mockResolvedValue(0) })
      .compile();
    await worker.init();

    await worker.close();
    worker = undefined;

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
