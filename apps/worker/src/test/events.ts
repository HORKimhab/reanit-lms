// Outbox events and fakes of the queue side, for unit tests of the events pipeline.
import type { OutboxEvent } from "@reanit/core/events";

/** A paid order, as the outbox hands it to the relay. */
export const ORDER_PAID: OutboxEvent = {
  id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a40",
  type: "OrderPaid",
  schoolId: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a10",
  payload: { orderId: "o-1", userId: "u-1", courseIds: ["c-1"] },
  occurredAt: new Date("2026-10-19T08:00:00.000Z"),
};

/**
 * Makes distinct copies of `ORDER_PAID`, as a batch from the outbox.
 *
 * @param count How many events.
 * @returns Events whose ids end in their index.
 */
export function orderPaidEvents(count: number): OutboxEvent[] {
  return Array.from({ length: count }, (_, index) => ({ ...ORDER_PAID, id: `${ORDER_PAID.id.slice(0, -4)}${String(index).padStart(4, "0")}` }));
}
