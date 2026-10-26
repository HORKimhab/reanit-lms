// Writes domain events to the outbox, inside the transaction of the change they record.
import type { DbClient } from "./client";
import type { Prisma } from "./generated/prisma/client";
import type { SchoolTransaction } from "./tenant";

/** Event types the outbox carries; matches `DomainEvent["type"]` in `@reanit/core/events`. */
type EventType = "OrderPaid" | "OrderRefunded" | "CourseCompleted" | "CommentPosted" | "StudentErased";

/** An event as it is written. */
type NewEvent = { type: EventType; schoolId: string; payload: Prisma.InputJsonObject };

/** An event as the relay reads it; matches `OutboxEvent` in `@reanit/core/events`. */
type StoredEvent = { id: string; type: EventType; schoolId: string; payload: Prisma.JsonObject; occurredAt: Date };

/**
 * Adds an event to the outbox, so it commits or rolls back with the change it records.
 *
 * @param tx Transaction scoped to the event's school.
 * @param event The event.
 * @param event.type What happened.
 * @param event.schoolId The school it happened in.
 * @param event.payload Its details.
 * @example
 * await appendEvent(tx, { type: "OrderPaid", schoolId, payload: { orderId, userId, courseIds } });
 */
export async function appendEvent(tx: SchoolTransaction, { type, schoolId, payload }: NewEvent) {
  await tx.outboxEvent.create({ data: { type, schoolId, payload } });
}

/**
 * The outbox's relay side, across every school: the worker is the one process that reads all of
 * them, as the table owner. It satisfies `OutboxStore` from `@reanit/core/events`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @returns The store operations.
 * @example
 * await createOutboxStore(db).publishPending(100, (events) => queue.addBulk(toJobs(events)));
 */
export function createOutboxStore(db: DbClient) {
  return {
    /**
     * Locks up to `limit` unpublished events (skipping ones another relay holds), hands them to
     * `publish`, and marks them published in the same transaction, so a failed publish leaves them pending.
     *
     * @param limit Most events to hand over.
     * @param publish Queues the events; throwing rolls the claim back.
     * @returns How many events were published.
     * @throws {Error} Whatever `publish` throws.
     */
    publishPending(limit: number, publish: (events: StoredEvent[]) => Promise<void>) {
      return db.$transaction(async (tx) => {
        const events = await tx.$queryRaw<StoredEvent[]>`
          SELECT id, school_id AS "schoolId", type, payload, occurred_at AS "occurredAt"
          FROM outbox_events
          WHERE published_at IS NULL
          ORDER BY occurred_at, id
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED`;
        if (events.length === 0) return 0;
        await publish(events);
        await tx.outboxEvent.updateMany({ where: { id: { in: events.map((event) => event.id) } }, data: { publishedAt: new Date() } });
        return events.length;
      });
    },
  };
}
