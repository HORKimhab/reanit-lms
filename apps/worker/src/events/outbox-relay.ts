import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import type { EventHandlers, OutboxStore } from "@reanit/core/events";
import type { JobsOptions, Queue } from "bullmq";

import { PeriodicTask } from "../shared/periodic-task";
import { toEventJobs } from "./event-job";
import { EVENT_HANDLERS, EVENT_JOB_OPTIONS, EVENTS_QUEUE, OUTBOX_STORE } from "./events.tokens";

/** How often the relay looks for new events. */
export const RELAY_INTERVAL_MS = 1000;
/** Most events claimed per transaction. */
export const RELAY_BATCH_SIZE = 100;

/**
 * Moves domain events from the outbox to the events queue. Each event becomes one job per handler of
 * its type, whose id names the event and the handler, so an event queued twice (a crash between
 * queueing and marking it published) runs each handler once. It runs every `RELAY_INTERVAL_MS`.
 */
@Injectable()
export class OutboxRelay extends PeriodicTask {
  /**
   * Receives the outbox, the queue, the handlers each event fans out to, and the retry options.
   *
   * @param outbox The outbox's relay side.
   * @param queue The events queue.
   * @param handlers The handlers by event type and name; one job is queued per handler.
   * @param jobOptions Retry options for every event job.
   */
  constructor(
    @Inject(OUTBOX_STORE) private readonly outbox: OutboxStore,
    @InjectQueue(EVENTS_QUEUE) private readonly queue: Queue,
    @Inject(EVENT_HANDLERS) private readonly handlers: EventHandlers,
    @Inject(EVENT_JOB_OPTIONS) private readonly jobOptions: JobsOptions,
  ) {
    super(RELAY_INTERVAL_MS, "Outbox relay failed");
  }

  /**
   * Relays every pending event.
   *
   * @returns How many events were queued.
   */
  protected runOnce() {
    return this.relayPending();
  }

  /**
   * Queues every pending event, batch by batch, until a batch comes back short.
   *
   * @returns How many events were queued.
   * @throws {Error} When the database or Redis fails; the claimed batch stays pending for the next run.
   */
  async relayPending(): Promise<number> {
    let total = 0;
    for (;;) {
      const count = await this.outbox.publishPending(RELAY_BATCH_SIZE, async (events) => {
        const jobs = events.flatMap((event) => toEventJobs(this.handlers, event));
        if (jobs.length > 0) await this.queue.addBulk(jobs.map(({ name, data, jobId }) => ({ name, data, opts: { ...this.jobOptions, jobId } })));
      });
      total += count;
      if (count < RELAY_BATCH_SIZE) return total;
    }
  }
}
