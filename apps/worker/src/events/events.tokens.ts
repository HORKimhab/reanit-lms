import type { JobsOptions } from "bullmq";

/** Queue the outbox relay fills with domain events, one job per event. */
export const EVENTS_QUEUE = "events";

/** Queue holding event jobs that failed every attempt, for someone to inspect and replay. */
export const EVENTS_DEAD_LETTER_QUEUE = "events-dead-letter";

/** Injection token for the `OutboxStore` the relay reads. */
export const OUTBOX_STORE = Symbol("OUTBOX_STORE");

/** Injection token for the `EventHandlers` the processor runs. */
export const EVENT_HANDLERS = Symbol("EVENT_HANDLERS");

/** Injection token for the retry options of every event job. */
export const EVENT_JOB_OPTIONS = Symbol("EVENT_JOB_OPTIONS");

/** How long finished jobs stay in Redis: their ids keep a re-relayed event from running again. */
const KEEP_FINISHED_JOBS_SECONDS = 24 * 60 * 60;

/** First retry after 1 s, then 2, 4 and 8 s: five attempts in about 15 s before the job is dead-lettered. */
export const DEFAULT_EVENT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { age: KEEP_FINISHED_JOBS_SECONDS },
  removeOnFail: { age: KEEP_FINISHED_JOBS_SECONDS },
};
