// Prices as the stores read and write them: how they bill, and the course or bundle they sell.
import type { BillingInterval, PriceKind } from "./generated/prisma/client";

/** Prices are integer minor units with an ISO code; the stores only know these two currencies. */
export type Currency = "USD" | "KHR";

/** A price's columns. */
export const PRICE_FIELDS = { id: true, amount: true, currency: true, kind: true, interval: true, installments: true } as const;

/** How a price bills; matches `Billing` in `@reanit/core/commerce`. */
export type Billing = { kind: "one_time" } | { kind: "recurring"; interval: BillingInterval } | { kind: "payment_plan"; installments: number };

/** A price as it is set; matches `PriceInput` in `@reanit/core/commerce`. */
export type PriceInput = { amount: number; currency: Currency; billing: Billing };

/** A price row as `PRICE_FIELDS` selects it. */
type PriceRow = { id: string; amount: number; currency: string; kind: PriceKind; interval: BillingInterval | null; installments: number | null };

/** What a price sells: its course, or its bundle with the bundle's courses in order. */
export const PRODUCT_FIELDS = {
  course: { select: { id: true, title: true } },
  bundle: { select: { id: true, title: true, courses: { orderBy: { position: "asc" }, select: { courseId: true } } } },
} as const;

/** A price's product as `PRODUCT_FIELDS` selects it. */
type ProductRow = {
  course: { id: string; title: string } | null;
  bundle: { id: string; title: string; courses: { courseId: string }[] } | null;
};

/**
 * Reads how a stored price bills; the table's check constraint guarantees each kind has its own
 * columns, so the fallbacks never apply.
 *
 * @param price The stored price's kind, period and instalments.
 * @param price.kind How it bills.
 * @param price.interval A recurring price's period.
 * @param price.installments A payment plan's number of payments.
 * @returns The billing.
 */
export function toBilling({ kind, interval, installments }: Pick<PriceRow, "kind" | "interval" | "installments">): Billing {
  if (kind === "recurring") return { kind, interval: interval ?? "month" };
  if (kind === "payment_plan") return { kind, installments: installments ?? 0 };
  return { kind };
}

/**
 * Turns a stored price into the price checkout uses: its currency narrowed and its billing read.
 *
 * @param row A stored price.
 * @returns The price, typed.
 */
export function toPrice(row: PriceRow) {
  return { id: row.id, amount: row.amount, currency: row.currency as Currency, billing: toBilling(row) };
}

/**
 * Turns a price as set into the columns that store it.
 *
 * @param price The price.
 * @param price.amount Amount in minor units, per payment.
 * @param price.currency ISO code.
 * @param price.billing How it bills.
 * @returns The price's columns.
 */
export function priceColumns({ amount, currency, billing }: PriceInput) {
  return {
    amount,
    currency,
    kind: billing.kind,
    interval: billing.kind === "recurring" ? billing.interval : null,
    installments: billing.kind === "payment_plan" ? billing.installments : null,
  };
}

/**
 * Reads what a price sells.
 *
 * @param price The price's course or bundle, as `PRODUCT_FIELDS` selects them.
 * @param price.course Its course, or null.
 * @param price.bundle Its bundle, or null.
 * @returns The title, the courses (one, or the bundle's in order) and the bundle's id (null for a course).
 */
export function productOf({ course, bundle }: ProductRow) {
  return {
    title: course?.title ?? bundle?.title ?? "",
    // A price belongs to a course or a bundle, never both.
    courseIds: course ? [course.id] : (bundle?.courses.map(({ courseId }) => courseId) ?? []),
    bundleId: bundle?.id ?? null,
  };
}
