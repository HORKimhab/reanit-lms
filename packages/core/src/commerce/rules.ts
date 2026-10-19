import { z } from "zod";

/** Currencies courses are sold in. Amounts are integer ISO 4217 minor units (two decimals for both). */
export const CURRENCIES = ["USD", "KHR"] as const;

/** Ways a student can pay; each has a gateway in apps/api. */
export const PAYMENT_METHODS = ["stripe", "aba_payway", "bakong_khqr"] as const;

/** Highest price accepted, in minor units: guards against a typo with extra zeros. */
const MAX_AMOUNT = 100_000_000;

/** A course price as the creator sets it. */
export const priceSchema = z.object({
  amount: z.number().int().positive().max(MAX_AMOUNT),
  currency: z.enum(CURRENCIES),
});

/** What the student picks at checkout. */
export const checkoutSchema = z.object({
  courseSlug: z.string().min(1).max(80),
  method: z.enum(PAYMENT_METHODS),
});

/** A currency courses are sold in. */
export type Currency = (typeof CURRENCIES)[number];
/** A way to pay. */
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
/** Parsed price input. */
export type PriceInput = z.infer<typeof priceSchema>;
/** Parsed checkout input. */
export type CheckoutInput = z.infer<typeof checkoutSchema>;
