import type { EventHandlers, OutboxEvent } from "@reanit/core/events";

/** An event with its time as an ISO string; distributes over the union, so each type keeps its own payload. */
type WithIsoTime<Event> = Event extends unknown ? Omit<Event, "occurredAt"> & { occurredAt: string } : never;

/** An outbox event as a queue job carries it: JSON, so the time is an ISO string. */
export type EventJob = WithIsoTime<OutboxEvent>;

/**
 * Turns an outbox event into the data of its queue job.
 *
 * @param event The event.
 * @returns The job data.
 */
export function toEventJob(event: OutboxEvent): EventJob {
  return { ...event, occurredAt: event.occurredAt.toISOString() };
}

/**
 * Runs the handler registered for an event's type; a type without one needs no work yet.
 *
 * @param handlers The handlers by event type.
 * @param job The event, as its job carries it.
 * @returns Resolves once the handler, if any, has run.
 * @throws {Error} Whatever the handler throws, so the queue retries the job.
 */
export async function dispatchEvent(handlers: EventHandlers, job: EventJob): Promise<void> {
  switch (job.type) {
    case "OrderPaid":
      return handlers.OrderPaid?.({ ...job, occurredAt: new Date(job.occurredAt) });
    case "CourseCompleted":
      return handlers.CourseCompleted?.({ ...job, occurredAt: new Date(job.occurredAt) });
  }
}
