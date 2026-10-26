import type { Billing, BillingInterval } from "./rules";

/** Days a student keeps access after a period ends unpaid, to pay late without losing their place. */
export const SUBSCRIPTION_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS_PER_INTERVAL: Record<BillingInterval, number> = { month: 1, year: 12 };

/** Where a subscription or payment plan stands, as stored. */
export type SubscriptionStatus = "pending" | "active" | "completed" | "lapsed";

/** What renewing a subscription needs to know about it. */
export interface SubscriptionTerms {
  /** How its price bills; never one-time. */
  billing: Exclude<Billing, { kind: "one_time" }>;
  /** Periods (or instalments) paid so far. */
  paidPeriods: number;
  /** The end of the last paid period; null before the first payment. */
  currentPeriodEnd: Date | null;
}

/** What one paid period changes. */
export interface SubscriptionChange {
  paidPeriods: number;
  currentPeriodEnd: Date;
  status: "active" | "completed";
  /** When the student loses access unless they pay again; null once a plan is paid off. */
  accessUntil: Date | null;
}

/**
 * Applies one paid period to a subscription's terms. Computed in core and run inside the payment's
 * transaction by `PaymentConfirmationStore.confirm`.
 */
export type RenewSubscription = (terms: SubscriptionTerms, paidAt: Date) => SubscriptionChange;

/**
 * Moves a date on by whole calendar months in UTC, ending on the month's last day when it is shorter
 * (31 January + 1 month is 28 or 29 February).
 *
 * @param date The start.
 * @param months How many months.
 * @returns The same time of day, `months` later.
 */
function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getTime());
  const day = target.getUTCDate();
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

/**
 * Applies a paid period: the new period starts when the last one ends, or at the payment when that is
 * later (a renewal after a lapse), and runs one interval; a payment plan bills monthly. A plan whose
 * last instalment this is completes and keeps its courses for good.
 *
 * @param terms The subscription's billing, paid periods and current period end.
 * @param terms.billing How its price bills.
 * @param terms.paidPeriods Periods paid before this one.
 * @param terms.currentPeriodEnd The end of the last paid period, or null before the first payment.
 * @param paidAt When the payment was confirmed.
 * @returns The subscription's new paid periods, period end, status and access end.
 * @example
 * renewSubscription({ billing: { kind: "recurring", interval: "month" }, paidPeriods: 0, currentPeriodEnd: null }, new Date("2026-01-31T09:00:00Z"));
 * // { paidPeriods: 1, currentPeriodEnd: 2026-02-28T09:00:00Z, status: "active", accessUntil: 2026-03-07T09:00:00Z }
 */
export function renewSubscription({ billing, paidPeriods, currentPeriodEnd }: SubscriptionTerms, paidAt: Date): SubscriptionChange {
  const start = currentPeriodEnd && currentPeriodEnd > paidAt ? currentPeriodEnd : paidAt;
  const months = billing.kind === "recurring" ? MONTHS_PER_INTERVAL[billing.interval] : MONTHS_PER_INTERVAL.month;
  const periodEnd = addMonths(start, months);
  const paid = paidPeriods + 1;
  const isComplete = billing.kind === "payment_plan" && paid >= billing.installments;
  return {
    paidPeriods: paid,
    currentPeriodEnd: periodEnd,
    status: isComplete ? "completed" : "active",
    accessUntil: isComplete ? null : new Date(periodEnd.getTime() + SUBSCRIPTION_GRACE_DAYS * DAY_MS),
  };
}

/**
 * Tells where a subscription stands for its student now: an active one whose grace period has passed
 * unpaid has lapsed, even before the worker records it.
 *
 * @param subscription The stored status and the end of its last paid period.
 * @param subscription.status As stored.
 * @param subscription.currentPeriodEnd The end of the last paid period, or null.
 * @param now The current time.
 * @returns The status to show.
 */
export function currentStatus({ status, currentPeriodEnd }: { status: SubscriptionStatus; currentPeriodEnd: Date | null }, now: Date): SubscriptionStatus {
  if (status !== "active" || !currentPeriodEnd) return status;
  return currentPeriodEnd.getTime() + SUBSCRIPTION_GRACE_DAYS * DAY_MS <= now.getTime() ? "lapsed" : "active";
}
