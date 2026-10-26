import {
  bundleCheckoutSchema,
  checkoutSchema,
  couponSchema,
  createBundleSchema,
  CURRENCIES,
  offerQuerySchema,
  PAYMENT_METHODS,
  priceSchema,
  refundSchema,
  updateBundleSchema,
} from "@reanit/core/commerce";
import { subdomainSchema } from "@reanit/core/schools";
import { z } from "zod";

import { courseSchema } from "../catalog/catalog.dto";
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

const priceResponseSchema = z.object({ amount: z.number().int(), currency: z.enum(CURRENCIES) });

/** A course's price, as the creator set it. */
export class PriceResponse extends createZodDto(z.object({ price: priceResponseSchema })) {}

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

/** The new order and what the browser does next: go to the gateway, post a form to it, or show a KHQR code. */
export class CheckoutResponse extends createZodDto(
  z.object({
    orderId: z.uuid(),
    payment: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("redirect"), url: z.url() }),
      z.object({ kind: z.literal("form"), action: z.url(), fields: z.record(z.string(), z.string()) }),
      z.object({ kind: z.literal("qr"), qr: z.string(), expiresAt: z.iso.datetime() }),
    ]),
  }),
) {}

/** An order as its buyer sees it. */
export class OrderResponse extends createZodDto(
  z.object({
    order: z.object({
      id: z.uuid(),
      status: z.enum(["pending", "paid", "failed", "refunded"]),
      courseId: z.uuid(),
      amount: z.number().int(),
      currency: z.enum(CURRENCIES),
      method: z.enum(PAYMENT_METHODS),
    }),
  }),
) {}
