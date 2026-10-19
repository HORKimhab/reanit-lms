import { checkoutSchema, CURRENCIES, PAYMENT_METHODS, priceSchema } from "@reanit/core/commerce";
import { subdomainSchema } from "@reanit/core/schools";
import { z } from "zod";

import { createZodDto } from "../http/zod-dto";

/** `PUT /courses/:id/price` body. */
export class PriceBody extends createZodDto(priceSchema) {}

/** Checkout body: the course and how to pay. */
export class CheckoutBody extends createZodDto(checkoutSchema) {}

/** Path of a school's selling routes. */
export class SchoolParams extends createZodDto(z.object({ subdomain: subdomainSchema })) {}

/** Path of a course's offer. */
export class OfferParams extends createZodDto(z.object({ subdomain: subdomainSchema, slug: z.string().min(1).max(80) })) {}

/** Path of an order. */
export class OrderParams extends createZodDto(z.object({ subdomain: subdomainSchema, orderId: z.uuid() })) {}

const priceResponseSchema = z.object({ amount: z.number().int(), currency: z.enum(CURRENCIES) });

/** A course's price, as the creator set it. */
export class PriceResponse extends createZodDto(z.object({ price: priceResponseSchema })) {}

/** How a course can be bought: its price (null when not for sale) and the methods that take its currency. */
export class OfferResponse extends createZodDto(
  z.object({ price: priceResponseSchema.nullable(), methods: z.array(z.enum(PAYMENT_METHODS)) }),
) {}

/** The new order and what the browser does next: go to the gateway, or show a KHQR code. */
export class CheckoutResponse extends createZodDto(
  z.object({
    orderId: z.uuid(),
    payment: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("redirect"), url: z.url() }),
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
