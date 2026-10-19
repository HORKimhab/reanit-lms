import type { OutboxEvent, OutboxStore } from "@reanit/core/events";
import { Logger } from "@nestjs/common";
import type { Queue } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ORDER_PAID, orderPaidEvents } from "../test/events";
import { DEFAULT_EVENT_JOB_OPTIONS } from "./events.tokens";
import { OutboxRelay, RELAY_BATCH_SIZE, RELAY_INTERVAL_MS } from "./outbox-relay";

/**
 * Builds an outbox that hands over the given batches in turn, then nothing.
 *
 * @param batches Events per call.
 * @returns The fake store, with its spy.
 */
function outboxHanding(...batches: OutboxEvent[][]) {
  const remaining = [...batches];
  const publishPending = vi.fn<OutboxStore["publishPending"]>(async (_limit, publish) => {
    const events = remaining.shift() ?? [];
    if (events.length > 0) await publish(events);
    return events.length;
  });
  return { publishPending };
}

/**
 * Builds a queue whose `addBulk` records what it is given.
 *
 * @returns The fake queue and its spy.
 */
function fakeQueue() {
  const addBulk = vi.fn().mockResolvedValue([]);
  return { queue: { addBulk } as unknown as Queue, addBulk };
}

/**
 * Starts a relay run that lasts until the test ends it.
 *
 * @returns The run's promise and the function that ends it with a count of published events.
 */
function manualRun() {
  let end: ((count: number) => void) | undefined;
  const promise = new Promise<number>((resolve) => {
    end = resolve;
  });
  // The executor runs synchronously, so `end` is set by now.
  return { promise, end: end! };
}

describe("relayPending", () => {
  it("queues each event as a job named after its type, with the event id as job id and the retry options", async () => {
    const { queue, addBulk } = fakeQueue();
    const relay = new OutboxRelay(outboxHanding([ORDER_PAID]), queue, DEFAULT_EVENT_JOB_OPTIONS);

    expect(await relay.relayPending()).toBe(1);

    expect(addBulk).toHaveBeenCalledWith([
      { name: "OrderPaid", data: { ...ORDER_PAID, occurredAt: "2026-10-19T08:00:00.000Z" }, opts: { ...DEFAULT_EVENT_JOB_OPTIONS, jobId: ORDER_PAID.id } },
    ]);
  });

  it("keeps claiming batches until one comes back short", async () => {
    const outbox = outboxHanding(orderPaidEvents(RELAY_BATCH_SIZE), orderPaidEvents(3));
    const relay = new OutboxRelay(outbox, fakeQueue().queue, DEFAULT_EVENT_JOB_OPTIONS);

    expect(await relay.relayPending()).toBe(RELAY_BATCH_SIZE + 3);
    expect(outbox.publishPending).toHaveBeenCalledTimes(2);
    expect(outbox.publishPending).toHaveBeenCalledWith(RELAY_BATCH_SIZE, expect.any(Function));
  });

  it("fails when the queue does, so the outbox keeps the batch pending", async () => {
    const { queue, addBulk } = fakeQueue();
    addBulk.mockRejectedValue(new Error("redis down"));

    await expect(new OutboxRelay(outboxHanding([ORDER_PAID]), queue, DEFAULT_EVENT_JOB_OPTIONS).relayPending()).rejects.toThrow("redis down");
  });
});

describe("relay timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("relays every interval from boot, never two runs at once, and stops on shutdown", async () => {
    // Each run lasts until the test resolves it, to see whether a tick starts another meanwhile.
    let run = manualRun();
    const publishPending = vi.fn<OutboxStore["publishPending"]>(() => run.promise);
    const relay = new OutboxRelay({ publishPending }, fakeQueue().queue, DEFAULT_EVENT_JOB_OPTIONS);
    relay.onApplicationBootstrap();

    await vi.advanceTimersByTimeAsync(RELAY_INTERVAL_MS * 3);
    expect(publishPending).toHaveBeenCalledTimes(1);

    run.end(0);
    run = manualRun();
    await vi.advanceTimersByTimeAsync(RELAY_INTERVAL_MS);
    expect(publishPending).toHaveBeenCalledTimes(2);

    const stopped = relay.onApplicationShutdown();
    run.end(0);
    await stopped;
    await vi.advanceTimersByTimeAsync(RELAY_INTERVAL_MS * 3);
    expect(publishPending).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("logs a failed run and tries again on the next tick", async () => {
    const logError = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const publishPending = vi.fn<OutboxStore["publishPending"]>().mockRejectedValueOnce(new Error("db down")).mockResolvedValue(0);
    const relay = new OutboxRelay({ publishPending }, fakeQueue().queue, DEFAULT_EVENT_JOB_OPTIONS);
    relay.onApplicationBootstrap();

    await vi.advanceTimersByTimeAsync(RELAY_INTERVAL_MS * 2);

    expect(publishPending).toHaveBeenCalledTimes(2);
    expect(logError).toHaveBeenCalledWith(new Error("db down"), "Outbox relay failed");
    await relay.onApplicationShutdown();
  });
});
