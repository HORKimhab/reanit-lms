import type { CommerceService } from "@reanit/core/commerce";

/** Injection token for the configured `PaymentGateway`s, in the order checkout offers them. */
export const PAYMENT_GATEWAYS = Symbol("PAYMENT_GATEWAYS");

/** Injection token for the Stripe client, or null when Stripe is not configured. */
export const STRIPE = Symbol("STRIPE");

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
