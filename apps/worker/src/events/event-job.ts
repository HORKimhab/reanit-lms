import type { EventHandlers, OutboxEvent } from "@reanit/core/events";

/** An event with its time as an ISO string; distributes over the union, so each type keeps its own payload. */
type WithIsoTime<Event> = Event extends unknown ? Omit<Event, "occurredAt"> & { occurredAt: string } : never;

/** An outbox event as a queue job carries it: JSON, so the time is an ISO string, with the handler the job runs. */
export type EventJob = WithIsoTime<OutboxEvent> & { handler: string };

/** A job to add to the events queue. */
type QueuedJob = { name: string; data: EventJob; jobId: string };

/**
 * Turns an outbox event into one queue job per handler of its type. Each job's id names the event and
 * the handler, so an event queued twice runs each handler once.
 *
 * @param handlers The handlers by event type and name.
 * @param event The event.
 * @returns The jobs; none for a type without handlers.
 */
export function toEventJobs(handlers: EventHandlers, event: OutboxEvent): QueuedJob[] {
  return Object.keys(handlers[event.type] ?? {}).map((handler) => ({
    name: `${event.type}.${handler}`,
    data: { ...event, occurredAt: event.occurredAt.toISOString(), handler },
    // BullMQ refuses custom job ids that contain a colon.
    jobId: `${event.id}.${handler}`,
  }));
}

/**
 * Turns a job back into the event its handler receives.
 *
 * @param job The job's data.
 * @param job.handler The handler it names; dropped.
 * @param job.occurredAt The event's time as an ISO string.
 * @returns The event, with its time as a date and without the handler name.
 */
function toEvent<Job extends EventJob>({ handler: _handler, occurredAt, ...event }: Job) {
  return { ...event, occurredAt: new Date(occurredAt) };
}

/**
 * Runs the handler a job names; a handler no longer registered has nothing to do.
 *
 * @param handlers The handlers by event type and name.
 * @param job The event and handler, as the job carries them.
 * @returns Resolves once the handler, if any, has run.
 * @throws {Error} Whatever the handler throws, so the queue retries the job.
 */
export async function dispatchEvent(handlers: EventHandlers, job: EventJob): Promise<void> {
  switch (job.type) {
    case "OrderPaid":
      return handlers.OrderPaid?.[job.handler]?.(toEvent(job));
    case "CourseCompleted":
      return handlers.CourseCompleted?.[job.handler]?.(toEvent(job));
    case "CommentPosted":
      return handlers.CommentPosted?.[job.handler]?.(toEvent(job));
    case "StudentErased":
      return handlers.StudentErased?.[job.handler]?.(toEvent(job));
  }
}
