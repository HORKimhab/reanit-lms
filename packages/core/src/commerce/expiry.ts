import type { Clock } from "../auth";
import type { OrderExpiryStore } from "./ports";
import { ORDER_EXPIRY_GRACE_MS, PAYMENT_METHODS, PAYMENT_WINDOWS_MS, type PaymentMethod } from "./rules";

/**
 * Builds the sweep that fails abandoned orders: a pending order whose gateway's payment window (plus
 * a grace period) has passed will not be paid, so it becomes `failed`. A gateway that confirms one
 * later still enrolls the student.
 *
 * @param dependencies Store and clock.
 * @param dependencies.store Pending orders across schools.
 * @param dependencies.clock The current time.
 * @returns The expiry operation.
 * @example
 * await createOrderExpiry({ store: createOrderExpiryStore(db), clock }).expireStaleOrders();
 */
export function createOrderExpiry({ store, clock }: { store: OrderExpiryStore; clock: Clock }) {
  return {
    /**
     * Fails every pending order past its gateway's window.
     *
     * @returns How many orders were failed.
     */
    expireStaleOrders(): Promise<number> {
      const now = clock.now().getTime();
      const placedBefore = Object.fromEntries(
        PAYMENT_METHODS.map((method) => [method, new Date(now - PAYMENT_WINDOWS_MS[method] - ORDER_EXPIRY_GRACE_MS)]),
      ) as Record<PaymentMethod, Date>;
      return store.failPendingOrders(placedBefore);
    },
  };
}

/** The order expiry use case. */
export type OrderExpiry = ReturnType<typeof createOrderExpiry>;
