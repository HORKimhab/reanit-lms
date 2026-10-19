import { InvalidCouponError } from "./errors";
import type { Coupon, Discount, Price } from "./ports";
import { minorStep } from "./rules";

/** Percent is out of this. */
const WHOLE_PERCENT = 100;

/**
 * Prices a course with a coupon: checks the coupon is still usable, then takes off its percent
 * (rounded down to the currency's step, so riel stay whole) or its fixed amount.
 *
 * @param price The course's price.
 * @param coupon The coupon the student typed.
 * @param now The current time, for the expiry.
 * @returns The coupon's code, the amount taken off and what is left to pay.
 * @throws {InvalidCouponError} When the coupon has expired, is used up, is in another currency, or would make the course free.
 * @example
 * applyCoupon({ id: "p", amount: 4900, currency: "USD" }, percentCoupon, new Date()); // { code, amountOff: 980, total: 3920 }
 */
export function applyCoupon(price: Price, coupon: Coupon, now: Date): Discount {
  if (coupon.expiresAt && coupon.expiresAt <= now) throw new InvalidCouponError("expired");
  if (coupon.maxRedemptions !== null && coupon.redemptions >= coupon.maxRedemptions) throw new InvalidCouponError("used_up");
  if (coupon.kind === "fixed" && coupon.currency !== price.currency) throw new InvalidCouponError("wrong_currency");

  const step = minorStep(price.currency);
  const amountOff =
    coupon.kind === "percent" ? Math.floor((price.amount * coupon.percentOff) / WHOLE_PERCENT / step) * step : coupon.amountOff;
  // Only a confirmed payment enrolls, so an order must charge something.
  if (amountOff >= price.amount) throw new InvalidCouponError("covers_price");
  return { code: coupon.code, amountOff, total: price.amount - amountOff };
}
