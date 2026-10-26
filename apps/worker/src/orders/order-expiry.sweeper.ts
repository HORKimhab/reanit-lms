import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OrderExpiry } from "@reanit/core/commerce";

import { PeriodicTask } from "../shared/periodic-task";
import { ORDER_EXPIRY } from "./orders.tokens";

/** How often abandoned orders are failed: well inside the shortest payment window (KHQR's 15 minutes). */
export const EXPIRY_INTERVAL_MS = 5 * 60 * 1000;

/** Fails abandoned pending orders every `EXPIRY_INTERVAL_MS`, across every school. */
@Injectable()
export class OrderExpirySweeper extends PeriodicTask {
  private readonly log = new Logger(OrderExpirySweeper.name);

  /**
   * Receives the expiry use case.
   *
   * @param expiry Fails pending orders past their gateway's window.
   */
  constructor(@Inject(ORDER_EXPIRY) private readonly expiry: OrderExpiry) {
    super(EXPIRY_INTERVAL_MS, "Order expiry failed");
  }

  /**
   * Fails the stale orders, and logs how many there were.
   *
   * @returns How many orders were failed.
   */
  protected async runOnce() {
    const failed = await this.expiry.expireStaleOrders();
    if (failed > 0) this.log.log(`Failed ${failed} abandoned orders`);
    return failed;
  }
}
