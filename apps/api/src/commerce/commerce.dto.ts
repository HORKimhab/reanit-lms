import {
  BILLING_INTERVALS,
  billingSchema,
  bundleCheckoutSchema,
  checkoutSchema,
  couponSchema,
  createBundleSchema,
  CURRENCIES,
  myOrdersQuerySchema,
  offerQuerySchema,
  offlinePaymentSchema,
  payoutAccountSchema,
  ORDER_STATUSES,
  orderListQuerySchema,
  PAYMENT_METHODS,
  priceSchema,
  recordPayoutSchema,
  refundSchema,
  renewSchema,
  updateBundleSchema,
  type CurrencyBalance,
  type DuePayout,
  type GatewayPaymentStart,
  type Payout,
  type OrderDetail,
  type PaymentMethod,
  type Price,
  type SubscriptionRecord,
} from "@reanit/core/commerce";
import {
  CREATOR_PLANS,
  PAID_PLANS,
  planCheckoutSchema,
  platformSchoolsQuerySchema,
  subdomainSchema,
  suspendSchoolSchema,
  type PlanPaymentStart,
  type PlanTerms,
  type PlatformSchool,
  type SchoolSuspension,
  type SubmittedPlanPayment,
} from "@reanit/core/schools";
import { z } from "zod";

import { courseSchema } from "../catalog/catalog.dto";
import { pageResponseSchema } from "../http/page-response";
import { createZodDto } from "../http/zod-dto";

/** A course's or bundle's slug in a path. */
const slugSchema = z.string().min(1).max(80);

/** `PUT /courses/:id/price` and `PUT /bundles/:id/price` body. */
export class PriceBody extends createZodDto(priceSchema) {}

/** Checkout body: the course and how to pay. */
export class CheckoutBody extends createZodDto(checkoutSchema) {}

/** Path of a school's selling routes. */
export class SchoolParams extends createZodDto(z.object({ subdomain: subdomainSchema })) {}

/** Path of a course's or bundle's public page and offer. */
export class OfferParams extends createZodDto(z.object({ subdomain: subdomainSchema, slug: slugSchema })) {}

/** Query of a course's offer: the coupon to price it with. */
export class OfferQuery extends createZodDto(offerQuerySchema) {}

/** `POST /coupons` body: the coupon, wrapped so its two kinds are documented as one field. */
export class CreateCouponBody extends createZodDto(z.object({ coupon: couponSchema })) {}

/** Path of a coupon or bundle. */
export class IdParams extends createZodDto(z.object({ id: z.uuid() })) {}

/** `POST /orders/:id/refund` body: whether staff already paid the student back, for KHQR and PayWay orders. */
export class RefundBody extends createZodDto(refundSchema) {}

/** Path of a bundle in the dashboard. */
export class BundleSlugParams extends createZodDto(z.object({ slug: slugSchema })) {}

/** `POST /bundles` body. */
export class CreateBundleBody extends createZodDto(createBundleSchema) {}

/** `PATCH /bundles/:id` body. */
export class UpdateBundleBody extends createZodDto(updateBundleSchema) {}

/** Bundle checkout body: the bundle and how to pay. */
export class BundleCheckoutBody extends createZodDto(bundleCheckoutSchema) {}

/** Path of an order. */
export class OrderParams extends createZodDto(z.object({ subdomain: subdomainSchema, orderId: z.uuid() })) {}

/** Path of one of the student's subscriptions. */
export class SubscriptionParams extends createZodDto(z.object({ subdomain: subdomainSchema, subscriptionId: z.uuid() })) {}

/** `POST .../subscriptions/:subscriptionId/renew` body: how to pay the next period. */
export class RenewBody extends createZodDto(renewSchema) {}

/** `POST .../orders/:orderId/offline-payment` body: the transaction reference the student's banking app showed. */
export class OfflinePaymentBody extends createZodDto(offlinePaymentSchema) {}

/** A price: the amount per payment, its currency, and how it bills. */
const priceResponseSchema = z.object({ amount: z.number().int(), currency: z.enum(CURRENCIES), billing: billingSchema });

/**
 * Shapes a price for a response, without its id.
 *
 * @param price The price.
 * @param price.amount Per payment, in minor units.
 * @param price.currency ISO code.
 * @param price.billing How it bills.
 * @returns The amount, currency and billing.
 */
export function toPriceResponse({ amount, currency, billing }: Price): z.infer<typeof priceResponseSchema> {
  return { amount, currency, billing };
}

/** A course's price, as the creator set it. */
export class PriceResponse extends createZodDto(z.object({ price: priceResponseSchema })) {}

/** A course's current price, or null before the creator sets one. */
export class CurrentPriceResponse extends createZodDto(z.object({ price: priceResponseSchema.nullable() })) {}

/** What a coupon takes off a price, and what is left to pay, in minor units. */
const discountResponseSchema = z.object({ code: z.string(), amountOff: z.number().int(), total: z.number().int() });

/**
 * How a course can be bought: its price (null when not for sale), the methods that take its currency,
 * and what the coupon in the query takes off (null without one).
 */
export class OfferResponse extends createZodDto(
  z.object({ price: priceResponseSchema.nullable(), methods: z.array(z.enum(PAYMENT_METHODS)), discount: discountResponseSchema.nullable() }),
) {}

/** A bundle with its courses in order and its price (null until set). */
const bundleResponseSchema = courseSchema.extend({
  courses: z.array(courseSchema.pick({ id: true, title: true, slug: true })),
  price: priceResponseSchema.nullable(),
});

/** One bundle. */
export class BundleResponse extends createZodDto(z.object({ bundle: bundleResponseSchema })) {}

/** A school's bundles, newest first. */
export class BundlesResponse extends createZodDto(z.object({ bundles: z.array(bundleResponseSchema) })) {}

/** Fields both coupon kinds have. */
const couponLimitsResponse = {
  id: z.uuid(),
  code: z.string(),
  /** Null: never expires. */
  expiresAt: z.iso.datetime().nullable(),
  /** Null: unlimited. */
  maxRedemptions: z.number().int().nullable(),
  /** Paid orders that used it. */
  redemptions: z.number().int(),
};

/** A coupon: a percent off, or a fixed amount off in one currency. */
const couponResponseSchema = z.discriminatedUnion("kind", [
  z.object({ ...couponLimitsResponse, kind: z.literal("percent"), percentOff: z.number().int() }),
  z.object({ ...couponLimitsResponse, kind: z.literal("fixed"), amountOff: z.number().int(), currency: z.enum(CURRENCIES) }),
]);

/** A school's coupon with how often it was used. */
export class CouponResponse extends createZodDto(z.object({ coupon: couponResponseSchema })) {}

/** A school's coupons, newest first. */
export class CouponsResponse extends createZodDto(z.object({ coupons: z.array(couponResponseSchema) })) {}

/** A gateway's next step for the browser: go to its page, post a form to it, or show a KHQR code. */
const GATEWAY_STEPS = [
  z.object({ kind: z.literal("redirect"), url: z.url() }),
  z.object({ kind: z.literal("form"), action: z.url(), fields: z.record(z.string(), z.string()) }),
  z.object({ kind: z.literal("qr"), qr: z.string(), expiresAt: z.iso.datetime() }),
] as const;

/** What the browser does next to pay: a gateway's step, or show a payment QR image (the school's, or the platform's for a plan) and then say the payment was made. */
const paymentStepSchema = z.discriminatedUnion("kind", [...GATEWAY_STEPS, z.object({ kind: z.literal("offline"), qrImageUrl: z.url() })]);

/**
 * Describes a gateway's next step for the browser, without the gateway's reference, which stays on the server.
 *
 * @param payment What the gateway returned.
 * @returns The step for the response.
 */
export function toGatewayStep(payment: GatewayPaymentStart): z.infer<(typeof GATEWAY_STEPS)[number]> {
  switch (payment.kind) {
    case "redirect":
      return { kind: "redirect", url: payment.url };
    case "form":
      return { kind: "form", action: payment.action, fields: payment.fields };
    case "qr":
      return { kind: "qr", qr: payment.qr, expiresAt: payment.expiresAt.toISOString() };
  }
}

/** The new order and what the browser does next. */
export class CheckoutResponse extends createZodDto(z.object({ orderId: z.uuid(), payment: paymentStepSchema })) {}

/** An order as its buyer sees it. */
export class OrderResponse extends createZodDto(
  z.object({
    order: z.object({
      id: z.uuid(),
      status: z.enum(ORDER_STATUSES),
      courseId: z.uuid(),
      amount: z.number().int(),
      currency: z.enum(CURRENCIES),
      method: z.enum(PAYMENT_METHODS),
    }),
  }),
) {}

/** `GET /schools/by-subdomain/:subdomain/orders` query: a page of the student's own orders. */
export class MyOrdersQuery extends createZodDto(myOrdersQuerySchema) {}

/** `GET /orders` query: filters by status, course, currency and days placed, and a page. */
export class OrderListQuery extends createZodDto(orderListQuerySchema) {}

const money = z.object({ amount: z.number().int(), currency: z.enum(CURRENCIES) });

/** An order with its courses and buyer, as order history and receipts show it. */
const orderDetailSchema = z.object({
  id: z.uuid(),
  status: z.enum(ORDER_STATUSES),
  method: z.enum(PAYMENT_METHODS),
  total: money,
  items: z.array(money.extend({ courseId: z.uuid(), title: z.string() })),
  bundleTitle: z.string().nullable(),
  couponCode: z.string().nullable(),
  buyer: z.object({ id: z.uuid(), name: z.string().nullable(), email: z.string() }),
  createdAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
  refundedAt: z.iso.datetime().nullable(),
  isRefundedByHand: z.boolean(),
  /** The transaction reference the student gave for an offline QR payment, or null. */
  paymentReference: z.string().nullable(),
});

/** One page of orders, newest first. */
export class OrdersResponse extends createZodDto(pageResponseSchema("orders", orderDetailSchema)) {}

/** One order with its courses and buyer. */
export class OrderDetailResponse extends createZodDto(z.object({ order: orderDetailSchema })) {}

/**
 * Shapes an order for a response, with its times as ISO strings.
 *
 * @param order The order.
 * @returns The order as the API sends it.
 */
export function toOrderDetailResponse(order: OrderDetail): OrderDetailResponse["order"] {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    refundedAt: order.refundedAt?.toISOString() ?? null,
  };
}

/** A student's subscription or payment plan as their purchases show it. */
const subscriptionResponseSchema = z.object({
  id: z.uuid(),
  status: z.enum(["active", "completed", "lapsed"]),
  title: z.string(),
  price: priceResponseSchema,
  /** How its next payment can be made, the default first. */
  methods: z.array(z.enum(PAYMENT_METHODS)),
  paidPeriods: z.number().int(),
  /** The end of the last paid period. */
  currentPeriodEnd: z.iso.datetime(),
});

/** The student's subscriptions and payment plans in the school, newest first. */
export class SubscriptionsResponse extends createZodDto(z.object({ subscriptions: z.array(subscriptionResponseSchema) })) {}

/**
 * Shapes a paid subscription for a response.
 *
 * @param subscription A subscription that was paid at least once, so it has a period end and is not pending, with its payment methods.
 * @returns The subscription as the API sends it.
 */
export function toSubscriptionResponse(subscription: SubscriptionRecord & { methods: PaymentMethod[] }): z.infer<typeof subscriptionResponseSchema> {
  const { id, status, title, price, methods, paidPeriods, currentPeriodEnd } = subscription;
  // Only paid subscriptions are listed: never pending, always with a period end.
  return { id, status: status as Exclude<typeof status, "pending">, title, price: toPriceResponse(price), methods, paidPeriods, currentPeriodEnd: currentPeriodEnd!.toISOString() };
}

/** `POST /schools/current/plan/checkout` body. */
export class PlanCheckoutBody extends createZodDto(planCheckoutSchema) {}

/** What a plan costs and allows. */
const planTermsSchema = z.object({
  /** USD cents a month and a year; null for Free. */
  prices: z.object({ month: z.number().int(), year: z.number().int() }).nullable(),
  /** The platform's fee on each sale, in hundredths of a percent. */
  feeBasisPoints: z.number().int(),
  limits: z.object({
    /** Null: no limit. */
    publishedCourses: z.number().int().nullable(),
    teamMembers: z.number().int().nullable(),
    customDomain: z.boolean(),
    offlineQr: z.boolean(),
  }),
});

/** Every plan with its terms, cheapest first. */
export class PlansResponse extends createZodDto(z.object({ plans: z.array(planTermsSchema.extend({ plan: z.enum(CREATOR_PLANS) })) })) {}

/** The school's plan in force, its terms, what was last paid for, and how a plan can be paid. */
export class SchoolPlanResponse extends createZodDto(
  z.object({
    plan: z.enum(CREATOR_PLANS),
    terms: planTermsSchema,
    paid: z.object({ plan: z.enum(PAID_PLANS), interval: z.enum(BILLING_INTERVALS), periodEnd: z.iso.datetime() }).nullable(),
    methods: z.array(z.enum(PAYMENT_METHODS)),
  }),
) {}

/** The new plan payment and what the browser does next: a gateway's step, or the platform's QR to scan and then say the creator paid. */
export class PlanCheckoutResponse extends createZodDto(
  z.object({ paymentId: z.uuid(), payment: paymentStepSchema }),
) {}

/**
 * Describes a plan payment's next step for the browser.
 *
 * @param payment The gateway's step, or the platform's QR.
 * @returns The step for the response.
 */
export function toPlanPaymentStep(payment: PlanPaymentStart): z.infer<typeof paymentStepSchema> {
  return payment.kind === "offline" ? payment : toGatewayStep(payment);
}

/** `/schools/current/plan/payments/:id` path. */
export class PlanPaymentParams extends createZodDto(z.object({ id: z.uuid() })) {}

/** Where a plan payment stands, up to date with the gateway. */
export class PlanPaymentResponse extends createZodDto(z.object({ status: z.enum(["pending", "paid", "failed"]) })) {}

/**
 * Shapes a plan's terms for a response.
 *
 * @param terms The terms.
 * @returns The prices, fee and limits.
 */
export function toPlanTermsResponse(terms: PlanTerms): z.infer<typeof planTermsSchema> {
  return { prices: terms.prices, feeBasisPoints: terms.feeBasisPoints, limits: terms.limits };
}

/** `PUT /schools/current/payout-account` body: where the school's payouts are sent. */
export class PayoutAccountBody extends createZodDto(payoutAccountSchema) {}

/** `POST /admin/payouts` body: a transfer made to a school. */
export class RecordPayoutBody extends createZodDto(recordPayoutSchema) {}

const payoutAccountResponseSchema = z.object({ holderName: z.string(), bankName: z.string(), account: z.string() });

const payoutSchema = z.object({ id: z.uuid(), currency: z.enum(CURRENCIES), amount: z.number().int(), paidAt: z.iso.datetime(), reference: z.string() });

/** The school's payout details. */
export class PayoutAccountResponse extends createZodDto(z.object({ account: payoutAccountResponseSchema })) {}

/** What the platform owes the school, when and above what it pays out, where it sends it, and what it paid. */
export class SchoolPayoutsResponse extends createZodDto(
  z.object({
    balances: z.array(z.object({ currency: z.enum(CURRENCIES), available: z.number().int(), onHold: z.number().int() })),
    nextPayoutDate: z.iso.datetime(),
    minimums: z.object({ USD: z.number().int(), KHR: z.number().int() }),
    account: payoutAccountResponseSchema.nullable(),
    payouts: z.array(payoutSchema),
  }),
) {}

/** The payouts due: each school's available balance that reaches the minimum, with where to send it. */
export class DuePayoutsResponse extends createZodDto(
  z.object({
    payouts: z.array(
      z.object({
        school: z.object({ id: z.uuid(), name: z.string(), subdomain: z.string() }),
        account: payoutAccountResponseSchema.nullable(),
        currency: z.enum(CURRENCIES),
        amount: z.number().int(),
      }),
    ),
  }),
) {}

/** The payout just recorded, with its school. */
export class RecordedPayoutResponse extends createZodDto(z.object({ payout: payoutSchema.extend({ schoolId: z.uuid() }) })) {}

/**
 * Shapes a payout for a response.
 *
 * @param payout The payout.
 * @returns The payout with its date as an ISO string.
 */
export function toPayoutResponse(payout: Payout): z.infer<typeof payoutSchema> {
  return { ...payout, paidAt: payout.paidAt.toISOString() };
}

/**
 * Shapes the balances for a response, in a stable order.
 *
 * @param balances The balances.
 * @returns The balances.
 */
export function toBalancesResponse(balances: CurrencyBalance[]): SchoolPayoutsResponse["balances"] {
  return balances.map(({ currency, available, onHold }) => ({ currency, available, onHold }));
}

/**
 * Shapes a payout due for a response.
 *
 * @param due The payout due.
 * @returns It as the API sends it.
 */
export function toDuePayoutResponse(due: DuePayout): DuePayoutsResponse["payouts"][number] {
  return { school: due.school, account: due.account, currency: due.currency, amount: due.amount };
}

/** `GET /admin/schools` query: a search and a page. */
export class PlatformSchoolsQuery extends createZodDto(platformSchoolsQuerySchema) {}

/** `PUT /admin/schools/:id/suspension` body: why the school is taken offline. */
export class SuspendSchoolBody extends createZodDto(suspendSchoolSchema) {}

/** `/admin/schools/:id` and `/admin/plan-payments/:id` paths. */
export class AdminIdParams extends createZodDto(z.object({ id: z.uuid() })) {}

const suspensionSchema = z.object({ at: z.iso.datetime(), reason: z.string() }).nullable();

const platformSchoolSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  subdomain: z.string(),
  createdAt: z.iso.datetime(),
  ownerEmail: z.string().nullable(),
  plan: z.enum(CREATOR_PLANS),
  paidUntil: z.iso.datetime().nullable(),
  suspension: suspensionSchema,
});

/** One page of schools, newest first, for platform admins. */
export class PlatformSchoolsResponse extends createZodDto(pageResponseSchema("schools", platformSchoolSchema)) {}

/** A school's suspension after a platform admin changed it; null once it is back online. */
export class SchoolSuspensionResponse extends createZodDto(z.object({ schoolId: z.uuid(), suspension: suspensionSchema })) {}

/** Payments to the platform's QR whose creators say they paid, oldest first. */
export class SubmittedPlanPaymentsResponse extends createZodDto(
  z.object({
    payments: z.array(
      z.object({
        id: z.uuid(),
        school: z.object({ id: z.uuid(), name: z.string(), subdomain: z.string() }),
        plan: z.enum(PAID_PLANS),
        interval: z.enum(BILLING_INTERVALS),
        amount: z.number().int(),
        reference: z.string(),
        submittedAt: z.iso.datetime(),
      }),
    ),
  }),
) {}

/** A plan payment a platform admin confirmed or rejected, with its school. */
export class PlanPaymentDecisionResponse extends createZodDto(z.object({ payment: z.object({ id: z.uuid(), schoolId: z.uuid(), status: z.enum(["paid", "failed"]) }) })) {}

/**
 * Shapes a suspension for a response.
 *
 * @param suspension The suspension, or null.
 * @returns It with its time as an ISO string.
 */
export function toSuspensionResponse(suspension: SchoolSuspension | null): z.infer<typeof suspensionSchema> {
  return suspension && { at: suspension.at.toISOString(), reason: suspension.reason };
}

/**
 * Shapes a school for platform admins.
 *
 * @param school The school.
 * @returns It with its times as ISO strings.
 */
export function toPlatformSchoolResponse(school: PlatformSchool): z.infer<typeof platformSchoolSchema> {
  return { ...school, createdAt: school.createdAt.toISOString(), paidUntil: school.paidUntil?.toISOString() ?? null, suspension: toSuspensionResponse(school.suspension) };
}

/**
 * Shapes a submitted plan payment for platform admins.
 *
 * @param payment The payment.
 * @returns It with its time as an ISO string.
 */
export function toSubmittedPlanPaymentResponse(payment: SubmittedPlanPayment): SubmittedPlanPaymentsResponse["payments"][number] {
  return { ...payment, submittedAt: payment.submittedAt.toISOString() };
}
