/** A buyer's order was confirmed paid and they were enrolled in its courses. */
export interface OrderPaid {
  type: "OrderPaid";
  schoolId: string;
  payload: { orderId: string; userId: string; courseIds: string[] };
}

/** A student completed every lesson of a course. */
export interface CourseCompleted {
  type: "CourseCompleted";
  schoolId: string;
  payload: { enrollmentId: string; courseId: string };
}

/** Something that happened in a school, written to the outbox in the same transaction as the change itself. */
export type DomainEvent = OrderPaid | CourseCompleted;

/** A domain event as the outbox stores and relays it. */
export type OutboxEvent = DomainEvent & {
  /** Unique; also the queue job id, so relaying an event twice runs it once. */
  id: string;
  occurredAt: Date;
};

/**
 * The outbox's relay side. `@reanit/db` implements it with `createOutboxStore`; the worker relays
 * what it hands over to the job queue.
 */
export interface OutboxStore {
  /**
   * Hands up to `limit` unpublished events, oldest first, to `publish`, and marks them published only
   * when it resolves; when it throws, they stay unpublished for the next run. Concurrent relays never get the same event.
   */
  publishPending(limit: number, publish: (events: OutboxEvent[]) => Promise<void>): Promise<number>;
}

/** What the worker runs for each event type; a type without a handler needs no background work yet. */
export type EventHandlers = {
  [Type in DomainEvent["type"]]?: (event: Extract<OutboxEvent, { type: Type }>) => Promise<void>;
};
