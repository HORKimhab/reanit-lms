import { Module } from "@nestjs/common";
import type { Clock } from "@reanit/core/auth";
import { createOrderExpiry, createRenewalSweep } from "@reanit/core/commerce";
import { createOrderExpiryStore, createRenewalSweepStore, type DbClient } from "@reanit/db";
import { DB_CLIENT } from "@reanit/nest";

import { OrderExpirySweeper } from "./order-expiry.sweeper";
import { ORDER_EXPIRY, RENEWAL_SWEEP } from "./orders.tokens";
import { RenewalSweeper } from "./renewal.sweeper";

/** The machine's clock. */
const systemClock: Clock = {
  /**
   * Reads the current time.
   *
   * @returns Now.
   */
  now() {
    return new Date();
  },
};

/**
 * Wires order expiry to Postgres and the system clock.
 *
 * @param db The shared database client.
 * @returns The expiry use case.
 */
function provideOrderExpiry(db: DbClient) {
  return createOrderExpiry({ store: createOrderExpiryStore(db), clock: systemClock });
}

/**
 * Wires the renewal sweep to Postgres and the system clock.
 *
 * @param db The shared database client.
 * @returns The renewal sweep.
 */
function provideRenewalSweep(db: DbClient) {
  return createRenewalSweep({ store: createRenewalSweepStore(db), clock: systemClock });
}

/** Order upkeep: the sweeps that fail abandoned orders, and lapse and notice subscriptions. */
@Module({
  providers: [
    { provide: ORDER_EXPIRY, inject: [DB_CLIENT], useFactory: provideOrderExpiry },
    OrderExpirySweeper,
    { provide: RENEWAL_SWEEP, inject: [DB_CLIENT], useFactory: provideRenewalSweep },
    RenewalSweeper,
  ],
})
export class OrdersModule {}
