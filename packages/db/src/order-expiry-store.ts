import type { DbClient } from "./client";
import type { PaymentMethod } from "./generated/prisma/client";

/**
 * Pending orders across every school, for the worker's expiry sweep: like the outbox relay, the sweep
 * is one cross-tenant job, so it uses the unscoped client and touches only orders still `pending`. It
 * satisfies `OrderExpiryStore` from `@reanit/core/commerce`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @returns The store operations.
 * @example
 * await createOrderExpiry({ store: createOrderExpiryStore(db), clock }).expireStaleOrders();
 */
export function createOrderExpiryStore(db: DbClient) {
  return {
    /**
     * Marks failed every pending order placed with a method before that method's cutoff.
     *
     * @param placedBefore Each payment method's cutoff.
     * @returns How many orders were failed.
     */
    async failPendingOrders(placedBefore: Record<PaymentMethod, Date>) {
      const stale = Object.entries(placedBefore).map(([method, cutoff]) => ({ paymentMethod: method as PaymentMethod, createdAt: { lt: cutoff } }));
      const { count } = await db.order.updateMany({ where: { status: "pending", OR: stale }, data: { status: "failed" } });
      return count;
    },
  };
}
