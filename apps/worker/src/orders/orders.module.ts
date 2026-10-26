import { Module } from "@nestjs/common";
import type { Clock } from "@reanit/core/auth";
import { createOrderExpiry } from "@reanit/core/commerce";
import { createOrderExpiryStore, type DbClient } from "@reanit/db";
import { DB_CLIENT } from "@reanit/nest";

import { OrderExpirySweeper } from "./order-expiry.sweeper";
import { ORDER_EXPIRY } from "./orders.tokens";

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

/** Order upkeep: the sweep that fails abandoned orders. */
@Module({
  providers: [{ provide: ORDER_EXPIRY, inject: [DB_CLIENT], useFactory: provideOrderExpiry }, OrderExpirySweeper],
})
export class OrdersModule {}
