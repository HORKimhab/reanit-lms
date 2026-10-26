import { Inject, Injectable, Logger } from "@nestjs/common";
import type { RenewalSweep } from "@reanit/core/commerce";

import { PeriodicTask } from "../shared/periodic-task";
import { RENEWAL_SWEEP } from "./orders.tokens";

/** How often renewals are swept: hourly, so notices and lapses land within an hour of their time. */
export const RENEWAL_INTERVAL_MS = 60 * 60 * 1000;

/** Lapses unpaid subscriptions and queues their renewal emails every `RENEWAL_INTERVAL_MS`, across every school. */
@Injectable()
export class RenewalSweeper extends PeriodicTask {
  private readonly log = new Logger(RenewalSweeper.name);

  /**
   * Receives the renewal sweep.
   *
   * @param renewals Lapses and notices subscriptions.
   */
  constructor(@Inject(RENEWAL_SWEEP) private readonly renewals: RenewalSweep) {
    super(RENEWAL_INTERVAL_MS, "Renewal sweep failed");
  }

  /**
   * Sweeps once, and logs what it did when it did anything.
   *
   * @returns How many subscriptions lapsed, got the renewal notice and got the last-day reminder.
   */
  protected async runOnce() {
    const result = await this.renewals.sweep();
    const { lapsed, noticed, reminded } = result;
    if (lapsed + noticed + reminded > 0) this.log.log(`Renewals: ${lapsed} lapsed, ${noticed} noticed, ${reminded} reminded`);
    return result;
  }
}
