import type { CommerceService, OrderHistory, Payouts } from "@reanit/core/commerce";
import type { PlanBilling } from "@reanit/core/schools";

/** Injection token for the configured `PaymentGateway`s, in the order checkout offers them. */
export const PAYMENT_GATEWAYS = Symbol("PAYMENT_GATEWAYS");

/** Injection token for the Stripe client, or null when Stripe is not configured. */
export const STRIPE = Symbol("STRIPE");

/** Injection token for the card gateway (Stripe, or the end-to-end tests' fake), or null when neither is set. */
export const CARD = Symbol("CARD");

/** Injection token for the PayWay gateway, or null when PayWay is not configured. */
export const PAYWAY = Symbol("PAYWAY");

/** Injection token for the Bakong KHQR gateway, or null when Bakong is not configured. */
export const BAKONG = Symbol("BAKONG");

/** Injection token for `CommerceForSchool`. */
export const COMMERCE_FOR_SCHOOL = Symbol("COMMERCE_FOR_SCHOOL");

/** Injection token for the `PaymentConfirmation` from `@reanit/core/commerce`. */
export const PAYMENT_CONFIRMATION = Symbol("PAYMENT_CONFIRMATION");

/** Builds one school's commerce service on the tenant client. */
export type CommerceForSchool = (schoolId: string) => CommerceService;

/** Injection token for `OrderHistoryForSchool`. */
export const ORDER_HISTORY_FOR_SCHOOL = Symbol("ORDER_HISTORY_FOR_SCHOOL");

/** Builds one school's order history on the tenant client. */
export type OrderHistoryForSchool = (schoolId: string) => OrderHistory;

/** Injection token for `PlanBillingForSchool`. */
export const PLAN_BILLING_FOR_SCHOOL = Symbol("PLAN_BILLING_FOR_SCHOOL");

/** Builds one school's plan billing on the tenant client. */
export type PlanBillingForSchool = (schoolId: string) => PlanBilling;

/** Injection token for `PayoutsForSchool`. */
export const PAYOUTS_FOR_SCHOOL = Symbol("PAYOUTS_FOR_SCHOOL");

/** Builds one school's payouts on the tenant client. */
export type PayoutsForSchool = (schoolId: string) => Payouts;

/** Injection token for the `PayoutAdmin` from `@reanit/core/commerce`. */
export const PAYOUT_ADMIN = Symbol("PAYOUT_ADMIN");
