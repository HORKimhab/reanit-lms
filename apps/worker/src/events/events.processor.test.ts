import { captureException } from "@sentry/node";
import type { Job, Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { ORDER_PAID } from "../test/events";
import { toEventJobs, type EventJob } from "./event-job";
import { EventsProcessor, type DeadLetter } from "./events.processor";

vi.mock("@sentry/node", async (importOriginal) => ({ ...(await importOriginal<object>()), captureException: vi.fn() }));

/** The receipt job of `ORDER_PAID`. */
const [JOB] = toEventJobs({ OrderPaid: { receipt: vi.fn() } }, ORDER_PAID);
const { name: JOB_NAME, data: DATA, jobId: JOB_ID } = JOB!; // OrderPaid has a handler, so there is a job

/**
 * Builds an event job that has been tried `attemptsMade` times out of `attempts`.
 *
 * @param attemptsMade Attempts so far.
 * @param attempts Attempts allowed.
 * @returns The job.
 */
function jobAfter(attemptsMade: number, attempts: number) {
  return { id: JOB_ID, name: JOB_NAME, data: DATA, attemptsMade, opts: { attempts } } as Job<EventJob>;
}

/**
 * Builds the processor with the given receipt handler for paid orders.
 *
 * @param orderPaid The handler.
 * @returns The processor and its dead-letter queue's `add` spy.
 */
function processorWith(orderPaid = vi.fn().mockResolvedValue(undefined)) {
  const add = vi.fn().mockResolvedValue(undefined);
  return { processor: new EventsProcessor({ OrderPaid: { receipt: orderPaid } }, { add } as unknown as Queue<DeadLetter>), add, orderPaid };
}

describe("EventsProcessor", () => {
  it("runs the handler the job names", async () => {
    const { processor, orderPaid } = processorWith();

    await processor.process(jobAfter(0, 5));

    expect(orderPaid).toHaveBeenCalledWith(ORDER_PAID);
  });

  it("dead-letters a job that failed its last attempt, keeping the event and the error", async () => {
    const { processor, add } = processorWith();

    await processor.deadLetter(jobAfter(5, 5), new Error("mail down"));

    expect(add).toHaveBeenCalledWith("OrderPaid.receipt", { event: DATA, error: "mail down", attemptsMade: 5 }, { jobId: `${ORDER_PAID.id}.receipt` });
  });

  it("reports a job that failed its last attempt to Sentry, tagged with its event and handler", async () => {
    const { processor } = processorWith();
    const error = new Error("mail down");

    await processor.deadLetter(jobAfter(5, 5), error);

    expect(captureException).toHaveBeenCalledWith(error, { tags: { event: "OrderPaid.receipt" } });
  });

  it("keeps a failure with attempts left out of Sentry", async () => {
    const { processor } = processorWith();

    await processor.deadLetter(jobAfter(4, 5), new Error("mail down"));

    expect(captureException).not.toHaveBeenCalled();
  });

  it("leaves a job with attempts left to BullMQ's retry", async () => {
    const { processor, add } = processorWith();

    await processor.deadLetter(jobAfter(4, 5), new Error("mail down"));

    expect(add).not.toHaveBeenCalled();
  });

  it("ignores a failure that belongs to no job", async () => {
    const { processor, add } = processorWith();

    await processor.deadLetter(undefined, new Error("connection lost"));

    expect(add).not.toHaveBeenCalled();
  });
});
