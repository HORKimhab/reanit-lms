import type { Clock } from "../auth";
import { SUBSCRIPTION_GRACE_DAYS } from "./subscriptions";

/** Days before a period ends that the student is emailed a link to pay the next one. */
export const RENEWAL_NOTICE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Active subscriptions across schools, for the worker's renewal sweep. Each operation marks what it
 * did on the subscription and writes its event in the same transaction, so the emails go out through
 * the outbox once per period. `@reanit/db` implements it with `createRenewalSweepStore`.
 */
export interface RenewalSweepStore {
  /** Lapses active subscriptions whose period ended at or before `periodEndBefore` (`SubscriptionLapsed`); returns how many. */
  lapseSubscriptions(periodEndBefore: Date): Promise<number>;
  /** Notes the coming renewal of active subscriptions whose period ends at or before `periodEndBefore`, once per period (`SubscriptionRenewalDue`); returns how many. */
  noticeRenewals(periodEndBefore: Date): Promise<number>;
  /** Notes the last grace day of active subscriptions whose period ended at or before `periodEndBefore`, once per period (`SubscriptionRenewalDue`, last day); returns how many. */
  noticeLastGraceDays(periodEndBefore: Date): Promise<number>;
}

/** What one sweep did. */
export interface RenewalSweepResult {
  lapsed: number;
  noticed: number;
  reminded: number;
}

/**
 * Builds the renewal sweep: subscriptions whose grace period passed unpaid lapse (their access already
 * ended with their enrollments' expiry); then students whose period ends within 3 days are emailed a
 * link to pay the next one, and again on the grace period's last day.
 *
 * @param dependencies Store and clock.
 * @param dependencies.store Active subscriptions across schools.
 * @param dependencies.clock The current time.
 * @returns The sweep operation.
 * @example
 * await createRenewalSweep({ store: createRenewalSweepStore(db), clock }).sweep();
 */
export function createRenewalSweep({ store, clock }: { store: RenewalSweepStore; clock: Clock }) {
  return {
    /**
     * Lapses, then notices, then reminds; lapsing first keeps a lapsed subscription out of the emails.
     *
     * @returns How many subscriptions lapsed, got the renewal notice and got the last-day reminder.
     */
    async sweep(): Promise<RenewalSweepResult> {
      const now = clock.now().getTime();
      const lapsed = await store.lapseSubscriptions(new Date(now - SUBSCRIPTION_GRACE_DAYS * DAY_MS));
      const noticed = await store.noticeRenewals(new Date(now + RENEWAL_NOTICE_DAYS * DAY_MS));
      const reminded = await store.noticeLastGraceDays(new Date(now - (SUBSCRIPTION_GRACE_DAYS - 1) * DAY_MS));
      return { lapsed, noticed, reminded };
    },
  };
}

/** The renewal sweep use case. */
export type RenewalSweep = ReturnType<typeof createRenewalSweep>;
