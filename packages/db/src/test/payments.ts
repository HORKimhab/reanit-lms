// Prices and confirmed payments for integration tests, through the real commerce stores.
import { createPaymentConfirmationStore } from "../commerce-store";
import type { DbClient } from "../client";
import type { PaymentMethod } from "../generated/prisma/client";

/** Billing of a price paid once. */
export const ONE_TIME = { kind: "one_time" } as const;

const DAY_MS = 24 * 60 * 60 * 1000;
/** A test period: 30 days, then a week's grace; core's real calendar months are tested in `@reanit/core`. */
const PERIOD_MS = 30 * DAY_MS;
const GRACE_MS = 7 * DAY_MS;

/**
 * Applies a paid period the simple way: 30 days from the later of the period's end and the payment,
 * access a week past it, and a plan complete on its last instalment.
 *
 * @param terms The subscription's billing, paid periods and current period end.
 * @param terms.billing How its price bills.
 * @param terms.paidPeriods Periods paid before this one.
 * @param terms.currentPeriodEnd The end of the last paid period, or null.
 * @param paidAt When the payment was confirmed.
 * @returns The new paid periods, period end, status and access end.
 */
export function renewForTest(
  { billing, paidPeriods, currentPeriodEnd }: { billing: { kind: "recurring" } | { kind: "payment_plan"; installments: number }; paidPeriods: number; currentPeriodEnd: Date | null },
  paidAt: Date,
) {
  const start = currentPeriodEnd && currentPeriodEnd > paidAt ? currentPeriodEnd : paidAt;
  const periodEnd = new Date(start.getTime() + PERIOD_MS);
  const paid = paidPeriods + 1;
  const isComplete = billing.kind === "payment_plan" && paid >= billing.installments;
  return {
    paidPeriods: paid,
    currentPeriodEnd: periodEnd,
    status: isComplete ? ("completed" as const) : ("active" as const),
    accessUntil: isComplete ? null : new Date(periodEnd.getTime() + GRACE_MS),
  };
}

/**
 * Confirms a gateway's payment now, as its webhook would.
 *
 * @param db Unscoped client on the test database.
 * @param method The gateway.
 * @param providerRef The gateway's reference.
 * @param at When it was confirmed; now by default.
 * @returns The order and whether this call paid it, or null when no order matches.
 */
export function payAtGateway(db: DbClient, method: Exclude<PaymentMethod, "offline_qr">, providerRef: string, at = new Date()) {
  return createPaymentConfirmationStore(db).confirm({ method, providerRef }, at, renewForTest);
}
