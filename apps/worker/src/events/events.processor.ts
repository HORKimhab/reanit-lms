import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import type { EventHandlers } from "@reanit/core/events";
import { reportError } from "@reanit/nest";
import type { Job, Queue } from "bullmq";

import { dispatchEvent, type EventJob } from "./event-job";
import { EVENT_HANDLERS, EVENTS_DEAD_LETTER_QUEUE, EVENTS_QUEUE } from "./events.tokens";

/** What a dead-lettered event job keeps: the event, why its last attempt failed, and how often it was tried. */
export type DeadLetter = { event: EventJob; error: string; attemptsMade: number };

/** Runs each event job's handler; a job that fails its last retry moves to the dead-letter queue. */
@Processor(EVENTS_QUEUE)
export class EventsProcessor extends WorkerHost {
  /**
   * Receives the handlers and the dead-letter queue.
   *
   * @param handlers What to run for each event type.
   * @param deadLetters Where jobs go after their last failed attempt.
   */
  constructor(
    @Inject(EVENT_HANDLERS) private readonly handlers: EventHandlers,
    @InjectQueue(EVENTS_DEAD_LETTER_QUEUE) private readonly deadLetters: Queue<DeadLetter>,
  ) {
    super();
  }

  /**
   * Runs the event's handler.
   *
   * @param job The event job.
   * @throws {Error} Whatever the handler throws, so BullMQ retries the job.
   */
  async process(job: Job<EventJob>): Promise<void> {
    await dispatchEvent(this.handlers, job.data);
  }

  /**
   * Dead-letters a job once it has used its last attempt, and reports it to Sentry; earlier failures are left to BullMQ's retry.
   *
   * @param job The failed job; BullMQ passes none when the failure was not a job's.
   * @param error Why the attempt failed.
   */
  @OnWorkerEvent("failed")
  async deadLetter(job: Job<EventJob> | undefined, error: Error) {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    reportError(error, { event: job.name });
    // The event id as job id keeps a retried dead-lettering from adding the event twice.
    await this.deadLetters.add(job.name, { event: job.data, error: error.message, attemptsMade: job.attemptsMade }, { jobId: job.id });
  }
}
