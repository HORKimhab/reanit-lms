import { getSharedConfigToken } from "@nestjs/bullmq";
import { Test, type TestingModule } from "@nestjs/testing";
import { DB_CLIENT, ENV } from "@reanit/nest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { bullOptions, parseWorkerEnv, WorkerModule } from "./worker.module";

const ENVIRONMENT = {
  DATABASE_URL: "postgresql://reanit:reanit@localhost:5432/reanit",
  REDIS_URL: "redis://localhost:6379",
};

let worker: TestingModule | undefined;

afterEach(async () => {
  await worker?.close();
  worker = undefined;
});

/**
 * Boots the worker with a fake database client; nothing connects anywhere.
 *
 * @returns The running worker and the fake client.
 */
async function bootWorker() {
  const db = { $disconnect: vi.fn() };
  worker = await Test.createTestingModule({ imports: [WorkerModule] })
    .overrideProvider(ENV)
    .useValue(parseWorkerEnv({ ...ENVIRONMENT, LOG_LEVEL: "silent" }))
    .overrideProvider(DB_CLIENT)
    .useValue(db)
    .compile();
  await worker.init();
  return { worker, db };
}

describe("parseWorkerEnv", () => {
  it("applies the default log level", () => {
    expect(parseWorkerEnv(ENVIRONMENT)).toEqual({ ...ENVIRONMENT, LOG_LEVEL: "info" });
  });

  it.each(["DATABASE_URL", "REDIS_URL"])("throws a ZodError when %s is missing", (name) => {
    expect(() => parseWorkerEnv({ ...ENVIRONMENT, [name]: undefined })).toThrow(ZodError);
  });
});

describe("bullOptions", () => {
  it("connects to REDIS_URL and lets blocking commands wait out a Redis restart", () => {
    expect(bullOptions(parseWorkerEnv(ENVIRONMENT))).toEqual({
      connection: { url: ENVIRONMENT.REDIS_URL, maxRetriesPerRequest: null },
    });
  });
});

describe("WorkerModule", () => {
  it("boots with BullMQ configured from the environment", async () => {
    const { worker } = await bootWorker();

    expect(worker.get(getSharedConfigToken())).toMatchObject({ connection: { url: ENVIRONMENT.REDIS_URL } });
  });

  it("keeps the process alive from boot until shutdown", async () => {
    vi.useFakeTimers();
    const { worker } = await bootWorker();
    const timersWhileRunning = vi.getTimerCount();

    await worker.close();

    expect(timersWhileRunning).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("closes the database pool on shutdown", async () => {
    const { worker, db } = await bootWorker();

    await worker.close();

    expect(db.$disconnect).toHaveBeenCalledOnce();
  });
});
