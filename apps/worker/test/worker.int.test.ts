import { getSharedConfigToken } from "@nestjs/bullmq";
import { Test, type TestingModule } from "@nestjs/testing";
import type { MailMessage } from "@reanit/core/auth";
import type { EventHandler, EventHandlers } from "@reanit/core/events";
import type { ObjectStorage } from "@reanit/core/media";
import {
  createCatalogStore,
  createCertificateStore,
  createCommerceStore,
  createDbClient,
  createLearningStore,
  createPaymentConfirmationStore,
  createSchoolStore,
} from "@reanit/db";
// Types `inject("databaseUrl")`.
import type {} from "@reanit/db/testing/postgres";
// Types `inject("redisUrl")`.
import type {} from "@reanit/nest/testing/redis";
import { DB_CLIENT, ENV, MAILER, OBJECT_STORAGE } from "@reanit/nest";
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
  S3_BUCKET: "reanit-media",
  S3_ACCESS_KEY_ID: "test-key",
  S3_SECRET_ACCESS_KEY: "test-secret",
  LOG_LEVEL: "silent",
});
let schoolId: string;
let worker: TestingModule | undefined;

/**
 * Boots the worker on the test Postgres and Redis, recording email and stored files instead of sending them.
 *
 * @param handlers What to run for each event type; the worker's own when left out.
 * @returns The running worker, the emails it sent and the files it stored.
 */
async function bootWorker(handlers?: EventHandlers) {
  const sent: MailMessage[] = [];
  const stored = new Map<string, { contentType: string; body: Uint8Array }>();
  const storage: Pick<ObjectStorage, "put"> = {
    /**
     * Records a file instead of uploading it.
     *
     * @param object The file.
     * @param object.key Its key.
     * @param object.contentType Its content type.
     * @param object.body Its bytes.
     */
    async put({ key, contentType, body }) {
      stored.set(key, { contentType, body });
    },
  };
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
    .overrideProvider(OBJECT_STORAGE)
    .useValue(storage)
    .overrideProvider(EVENT_JOB_OPTIONS)
    .useValue(FAST_RETRIES);
  if (handlers) builder = builder.overrideProvider(EVENT_HANDLERS).useValue(handlers);
  worker = await builder.compile();
  await worker.init();
  return { app: worker, sent, stored };
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
    const completed = vi.fn<EventHandler<"CourseCompleted">>().mockResolvedValue(undefined);
    await bootWorker({ CourseCompleted: { certificate: completed } });

    await completeCourse("relayed");

    await vi.waitFor(() => expect(completed).toHaveBeenCalledWith(expect.objectContaining({ schoolId, payload: { enrollmentId: "e-1", courseId: "relayed" } })), {
      timeout: EVENT_TIMEOUT_MS,
    });
    expect(completed.mock.lastCall?.[0].occurredAt).toBeInstanceOf(Date);
    expect(await db.outboxEvent.count({ where: { schoolId, publishedAt: null } })).toBe(0);
  });

  it("dead-letters a job whose handler fails every attempt", async () => {
    const failing = vi.fn<EventHandler<"CourseCompleted">>().mockRejectedValue(new Error("certificate service down"));
    await bootWorker({ CourseCompleted: { certificate: failing } });
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

  it("emails a paid order's buyer a receipt and a welcome in the language they bought in, and the owner about the sale", async () => {
    const { sent } = await bootWorker();
    const catalog = createCatalogStore(db, schoolId);
    const courseId = (await catalog.createCourse({ title: "Brand", slug: "brand" })).id;
    await catalog.updateCourse(courseId, { status: "published" });
    const commerce = createCommerceStore(db, schoolId);
    const price = await commerce.setPrice(courseId, { amount: 4900, currency: "USD" });
    const buyer = await db.user.create({ data: { email: "worker-buyer@example.com", name: "Sokha" } });
    // setPrice found the course it just created.
    const { id } = await commerce.createOrder({ userId: buyer.id, price: price!, lines: [{ courseId, amount: price!.amount }], bundleId: null, couponId: null, method: "stripe", locale: "km" });
    await commerce.setProviderRef(id, `cs_worker_${id}`);

    await createPaymentConfirmationStore(db).confirm("stripe", `cs_worker_${id}`);

    await vi.waitFor(() => expect(sent).toHaveLength(3), { timeout: EVENT_TIMEOUT_MS });
    const toBuyer = sent.filter(({ to }) => to === "worker-buyer@example.com");
    expect(toBuyer.map(({ subject }) => subject)).toEqual(["បង្កាន់ដៃរបស់អ្នកពី Worker", "សូមស្វាគមន៍មកកាន់ Brand"]);
    expect(toBuyer[1]?.html).toContain('href="https://reanit.test/km/s/worker-school/learn/brand"');
    const toOwner = sent.find(({ to }) => to === "worker-owner@example.com");
    expect(toOwner?.subject).toBe("New sale: Brand");
    expect(toOwner?.unsubscribeUrl).toMatch(/^https:\/\/reanit\.test\/unsubscribe\?token=[0-9a-f-]{36}&kind=newSale$/);
  });

  it("issues a completed course's certificate and stores its PDF, with a verify link in the student's language", async () => {
    const { stored } = await bootWorker();
    const courseId = (await createCatalogStore(db, schoolId).createCourse({ title: "Certified", slug: "certified" })).id;
    const student = await db.user.create({ data: { email: "worker-graduate@example.com", name: "Dara" } });
    const enrollment = await db.enrollment.create({ data: { schoolId, userId: student.id, courseId, source: "manual" } });

    await createLearningStore(db, schoolId).completeCourse({ id: enrollment.id, courseId }, new Date("2026-10-20T03:00:00Z"));

    const certificate = await vi.waitFor(
      async () => {
        const issued = await db.certificate.findUnique({ where: { enrollmentId: enrollment.id } });
        if (!issued?.pdfKey) throw new Error("No PDF yet");
        return issued;
      },
      { timeout: EVENT_TIMEOUT_MS },
    );
    expect(certificate).toMatchObject({ studentName: "Dara", courseTitle: "Certified", issuedAt: new Date("2026-10-20T03:00:00Z") });
    expect(certificate.pdfKey).toBe(`schools/${schoolId}/certificates/${certificate.id}.pdf`);
    const pdf = Buffer.from(stored.get(certificate.pdfKey ?? "")?.body ?? []).toString("latin1");
    expect(pdf).toContain(`/URI (https://reanit.test/s/worker-school/certificates/${certificate.id})`);
    expect(await createCertificateStore(db, schoolId).findCertificate(certificate.id)).toMatchObject({ studentName: "Dara", schoolName: "Worker" });
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
