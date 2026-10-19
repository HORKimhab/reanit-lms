import { getSharedConfigToken } from "@nestjs/bullmq";
import { Test, type TestingModule } from "@nestjs/testing";
import type { EventHandlers } from "@reanit/core/events";
import { createDbClient, createSchoolStore } from "@reanit/db";
import { DB_CLIENT, ENV } from "@reanit/nest";
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
let schoolId: string;
let worker: TestingModule | undefined;

/**
 * Boots the worker on the test Postgres and Redis with the given event handlers.
 *
 * @param handlers What to run for each event type.
 * @returns The running worker.
 */
async function bootWorker(handlers: EventHandlers) {
  worker = await Test.createTestingModule({ imports: [WorkerModule] })
    .overrideProvider(ENV)
    .useValue(parseWorkerEnv({ DATABASE_URL: inject("databaseUrl"), REDIS_URL: inject("redisUrl"), LOG_LEVEL: "silent" }))
    .overrideProvider(EVENT_HANDLERS)
    .useValue(handlers)
    .overrideProvider(EVENT_JOB_OPTIONS)
    .useValue(FAST_RETRIES)
    .compile();
  await worker.init();
  return worker;
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
    const app = await bootWorker({});

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
          const [job] = (await deadLetters.getWaiting()).filter((waiting) => waiting.data.event.payload.courseId === "doomed");
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

  it("closes the database pool on shutdown", async () => {
    const disconnect = vi.fn();
    worker = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(ENV)
      .useValue(parseWorkerEnv({ DATABASE_URL: inject("databaseUrl"), REDIS_URL: inject("redisUrl"), LOG_LEVEL: "silent" }))
      .overrideProvider(DB_CLIENT)
      .useValue({ $disconnect: disconnect, $transaction: vi.fn().mockResolvedValue(0) })
      .compile();
    await worker.init();

    await worker.close();
    worker = undefined;

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
