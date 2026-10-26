import { z } from "zod";

import { COURSE_STATUSES, DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from "../catalog/rules";
import { EMAIL_LOCALES } from "../notifications/rules";
import { SLUG_MAX_LENGTH } from "../shared/slug";

/** Currencies courses are sold in. Amounts are integer ISO 4217 minor units (two decimals for both). */
export const CURRENCIES = ["USD", "KHR"] as const;

/**
 * Ways a student can pay. Each but `offline_qr` has a gateway in apps/api; `offline_qr` is the
 * school's own static payment QR image, and staff confirm each such payment by hand.
 */
export const PAYMENT_METHODS = ["stripe", "aba_payway", "bakong_khqr", "offline_qr"] as const;

/** Methods that only take one-time prices: subscriptions and payment plans are paid by QR or PayWay. */
export const ONE_TIME_ONLY_METHODS: readonly PaymentMethod[] = ["stripe"];

/**
 * Methods whose gateway refunds through its API (Stripe). KHQR has no refund API and PayWay's needs a
 * key we do not hold, so staff pay those students back by hand and then confirm the refund.
 */
export const GATEWAY_REFUND_METHODS: readonly PaymentMethod[] = ["stripe"];

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * How long each method lets a student pay an order: a KHQR code lives 15 minutes, a Stripe Checkout
 * Session 24 hours, and an abandoned PayWay purchase is given as long. An offline QR order waits a week
 * for the student to say they paid; once they have, it waits for staff however long that takes.
 */
export const PAYMENT_WINDOWS_MS: Record<PaymentMethod, number> = {
  stripe: DAY_MS,
  aba_payway: DAY_MS,
  bakong_khqr: 15 * MINUTE_MS,
  offline_qr: 7 * DAY_MS,
};

/** Extra time past a payment window before a pending order counts as failed, for clocks and slow gateways. */
export const ORDER_EXPIRY_GRACE_MS = HOUR_MS;

/**
 * Where an order can be: waiting for payment, paid by offline QR and waiting for staff to confirm it,
 * paid, never paid, or paid and given back.
 */
export const ORDER_STATUSES = ["pending", "awaiting_confirmation", "paid", "failed", "refunded"] as const;

/** Highest price accepted, in minor units: guards against a typo with extra zeros. */
const MAX_AMOUNT = 100_000_000;

/** Minor units per major unit; riel have no coins below one, so KHR prices are whole riel. */
const MINOR_PER_MAJOR = 100;

/**
 * Smallest step an amount moves in, per currency, in minor units.
 *
 * @param currency The currency.
 * @returns 100 for riel (no coins below one riel), 1 otherwise.
 */
export function minorStep(currency: Currency): number {
  return currency === "KHR" ? MINOR_PER_MAJOR : 1;
}

/**
 * Tells whether an amount can be charged in a currency, i.e. it is a whole number of the currency's step.
 *
 * @param amount Amount in minor units.
 * @param currency The currency.
 * @returns True for whole riel and any USD amount.
 */
function isChargeableAmount(amount: number, currency: Currency): boolean {
  return amount % minorStep(currency) === 0;
}

/** Periods a recurring price can bill for. */
export const BILLING_INTERVALS = ["month", "year"] as const;

/** Fewest instalments a payment plan takes: one is a one-time price. */
const MIN_INSTALLMENTS = 2;
/** Most instalments a payment plan takes: two years of monthly payments. */
export const MAX_INSTALLMENTS = 24;

/**
 * How a price bills: once; every month or year until the student stops paying; or in a set number of
 * monthly instalments, after which the student keeps the course.
 */
export const billingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("one_time") }),
  z.object({ kind: z.literal("recurring"), interval: z.enum(BILLING_INTERVALS) }),
  z.object({ kind: z.literal("payment_plan"), installments: z.number().int().min(MIN_INSTALLMENTS).max(MAX_INSTALLMENTS) }),
]);

/** A course or bundle price as the creator sets it: the amount per payment, its currency and how it bills. */
export const priceSchema = z
  .object({
    amount: z.number().int().positive().max(MAX_AMOUNT),
    currency: z.enum(CURRENCIES),
    billing: billingSchema.default({ kind: "one_time" }),
  })
  .refine(({ amount, currency }) => isChargeableAmount(amount, currency), {
    message: "KHR prices are whole riel",
    path: ["amount"],
  });

/** Highest percent a coupon takes off: an order always charges something, since only a confirmed payment enrolls. */
export const MAX_PERCENT_OFF = 99;

/** Shortest coupon code. */
const COUPON_CODE_MIN_LENGTH = 3;
/** Longest coupon code. */
export const COUPON_CODE_MAX_LENGTH = 32;

/** Letters, digits, `-` and `_`, starting with a letter or digit; compared in upper case. */
const COUPON_CODE_PATTERN = new RegExp(`^[A-Z0-9][A-Z0-9_-]{${COUPON_CODE_MIN_LENGTH - 1},${COUPON_CODE_MAX_LENGTH - 1}}$`);

/** A coupon code as a student or creator types it, normalized to upper case. */
const couponCodeSchema = z.string().trim().toUpperCase().regex(COUPON_CODE_PATTERN, "Use 3 to 32 letters, digits, - or _");

/** When a coupon stops working and how often it can be used, shared by both kinds. */
const couponLimitsSchema = z.object({
  code: couponCodeSchema,
  /** ISO date-time, read into a Date; null: never expires. */
  expiresAt: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value))
    .nullable()
    .default(null),
  /** Null: unlimited. Counts paid orders. */
  maxRedemptions: z.number().int().positive().max(MAX_AMOUNT).nullable().default(null),
});

/** A coupon as the creator sets it up: a share of the price off, or a set amount in one currency. */
export const couponSchema = z
  .discriminatedUnion("kind", [
    couponLimitsSchema.extend({ kind: z.literal("percent"), percentOff: z.number().int().min(1).max(MAX_PERCENT_OFF) }),
    couponLimitsSchema.extend({ kind: z.literal("fixed"), amountOff: z.number().int().positive().max(MAX_AMOUNT), currency: z.enum(CURRENCIES) }),
  ])
  .refine((coupon) => coupon.kind !== "fixed" || isChargeableAmount(coupon.amountOff, coupon.currency), {
    message: "KHR amounts are whole riel",
    path: ["amountOff"],
  });

/** A course's or bundle's slug, as a URL carries it. */
const slugSchema = z.string().min(1).max(SLUG_MAX_LENGTH);

/** What the student picks at checkout, the coupon they typed, and the language they bought in, for their receipt. */
export const checkoutSchema = z.object({
  courseSlug: slugSchema,
  method: z.enum(PAYMENT_METHODS),
  couponCode: couponCodeSchema.optional(),
  locale: z.enum(EMAIL_LOCALES).default("en"),
});

/** Fewest courses a bundle holds: one course is just a course. */
const MIN_BUNDLE_COURSES = 2;
/** Most courses a bundle holds. */
export const MAX_BUNDLE_COURSES = 50;

/** A bundle's courses in display order, each once. */
const bundleCourseIdsSchema = z
  .array(z.uuid())
  .min(MIN_BUNDLE_COURSES)
  .max(MAX_BUNDLE_COURSES)
  .refine((ids) => new Set(ids).size === ids.length, { message: "Each course can be in a bundle once" });

/** New-bundle input: its title and courses. It starts as a draft without a price. */
export const createBundleSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
  courseIds: bundleCourseIdsSchema,
});

/** Bundle details input; omitted fields stay as they are. */
export const updateBundleSchema = z
  .object({
    title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
    description: z.string().trim().max(DESCRIPTION_MAX_LENGTH),
    status: z.enum(COURSE_STATUSES),
    courseIds: bundleCourseIdsSchema,
  })
  .partial();

/** What the student picks when buying a bundle: the same as for a course. */
export const bundleCheckoutSchema = checkoutSchema.omit({ courseSlug: true }).extend({ bundleSlug: slugSchema });

/** Renewing a subscription or paying a plan's next instalment: how to pay, and the language of the receipt. */
export const renewSchema = checkoutSchema.pick({ method: true, locale: true });

/** Longest transaction reference a student can give for an offline payment. */
const PAYMENT_REFERENCE_MAX_LENGTH = 100;

/** A student's word that they paid an offline QR order: the transaction reference their banking app showed. */
export const offlinePaymentSchema = z.object({ reference: z.string().trim().min(1).max(PAYMENT_REFERENCE_MAX_LENGTH) });

/** A course offer query: the coupon to price it with, if any. */
export const offerQuerySchema = z.object({ coupon: couponCodeSchema.optional() });

/** A currency courses are sold in. */
export type Currency = (typeof CURRENCIES)[number];
/** A way to pay. */
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
/** How a price bills. */
export type Billing = z.infer<typeof billingSchema>;
/** A recurring price's period. */
export type BillingInterval = (typeof BILLING_INTERVALS)[number];
/** Parsed renewal input. */
export type RenewInput = z.infer<typeof renewSchema>;
/** Parsed offline payment input. */
export type OfflinePaymentInput = z.infer<typeof offlinePaymentSchema>;
/** Parsed price input. */
export type PriceInput = z.infer<typeof priceSchema>;
/** Parsed coupon input. */
export type CouponInput = z.infer<typeof couponSchema>;
/** Parsed new-bundle input. */
export type CreateBundleInput = z.infer<typeof createBundleSchema>;
/** Parsed bundle-details input. */
export type UpdateBundleInput = z.infer<typeof updateBundleSchema>;
/** Parsed bundle checkout input. */
export type BundleCheckoutInput = z.infer<typeof bundleCheckoutSchema>;
/** Parsed offer query. */
export type OfferQuery = z.infer<typeof offerQuerySchema>;
/** Parsed checkout input. */
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Refund form: whether staff already paid the student back themselves, for gateways that cannot refund. */
export const refundSchema = z.object({ isRefundedByHand: z.boolean().default(false) });

/** Parsed refund input. */
export type RefundInput = z.infer<typeof refundSchema>;
