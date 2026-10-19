import { describe, expect, it } from "vitest";

import { applyCoupon } from "./coupons";
import { InvalidCouponError } from "./errors";
import type { Coupon, Price } from "./ports";

const NOW = new Date("2026-10-19T12:00:00Z");
const USD_PRICE: Price = { id: "p1", amount: 4999, currency: "USD" };
const KHR_PRICE: Price = { id: "p2", amount: 2_000_000, currency: "KHR" };

/**
 * Builds a percent coupon with no expiry or limit, unless overridden.
 *
 * @param overrides Fields to change.
 * @returns The coupon.
 */
function percentCoupon(overrides: Partial<Extract<Coupon, { kind: "percent" }>> = {}): Coupon {
  return { id: "c1", code: "SAVE20", kind: "percent", percentOff: 20, expiresAt: null, maxRedemptions: null, redemptions: 0, ...overrides };
}

/**
 * Builds a fixed USD coupon with no expiry or limit, unless overridden.
 *
 * @param overrides Fields to change.
 * @returns The coupon.
 */
function fixedCoupon(overrides: Partial<Extract<Coupon, { kind: "fixed" }>> = {}): Coupon {
  return { id: "c2", code: "TENOFF", kind: "fixed", amountOff: 1000, currency: "USD", expiresAt: null, maxRedemptions: null, redemptions: 0, ...overrides };
}

/**
 * Applies a coupon and returns why it was refused.
 *
 * @param price The price.
 * @param coupon The coupon.
 * @returns The refusal's reason, or null when it applied.
 * @throws {Error} Whatever else `applyCoupon` throws.
 */
function refusal(price: Price, coupon: Coupon) {
  try {
    applyCoupon(price, coupon, NOW);
    return null;
  } catch (error) {
    if (error instanceof InvalidCouponError) return error.reason;
    throw error;
  }
}

describe("applyCoupon", () => {
  it("takes a percent off, rounding the discount down to the cent", () => {
    expect(applyCoupon(USD_PRICE, percentCoupon(), NOW)).toEqual({ code: "SAVE20", amountOff: 999, total: 4000 });
  });

  it("keeps riel whole when it takes a percent off a KHR price", () => {
    expect(applyCoupon({ ...KHR_PRICE, amount: 2_000_300 }, percentCoupon({ percentOff: 15 }), NOW)).toEqual({ code: "SAVE20", amountOff: 300_000, total: 1_700_300 });
  });

  it("takes a fixed amount off a price in its currency", () => {
    expect(applyCoupon(USD_PRICE, fixedCoupon(), NOW)).toEqual({ code: "TENOFF", amountOff: 1000, total: 3999 });
  });

  it("works until the moment it expires, then refuses it", () => {
    expect(refusal(USD_PRICE, percentCoupon({ expiresAt: new Date(NOW.getTime() + 1) }))).toBeNull();
    expect(refusal(USD_PRICE, percentCoupon({ expiresAt: NOW }))).toBe("expired");
  });

  it("works below its usage limit and refuses it once used up", () => {
    expect(refusal(USD_PRICE, percentCoupon({ maxRedemptions: 3, redemptions: 2 }))).toBeNull();
    expect(refusal(USD_PRICE, percentCoupon({ maxRedemptions: 3, redemptions: 3 }))).toBe("used_up");
  });

  it("refuses a fixed coupon in another currency", () => {
    expect(refusal(KHR_PRICE, fixedCoupon())).toBe("wrong_currency");
  });

  it("refuses a fixed coupon that would make the course free", () => {
    expect(refusal(USD_PRICE, fixedCoupon({ amountOff: 4998 }))).toBeNull();
    expect(refusal(USD_PRICE, fixedCoupon({ amountOff: 4999 }))).toBe("covers_price");
  });
});
