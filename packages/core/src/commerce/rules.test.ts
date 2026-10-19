import { describe, expect, it } from "vitest";

import { checkoutSchema, couponSchema, priceSchema } from "./rules";

describe("priceSchema", () => {
  it.each([
    [{ amount: 4999, currency: "USD" }],
    [{ amount: 2_000_000, currency: "KHR" }],
  ])("accepts %j", (price) => {
    expect(priceSchema.parse(price)).toEqual(price);
  });

  it.each([
    ["a fraction of a riel", { amount: 2_000_050, currency: "KHR" }],
    ["a fractional amount", { amount: 49.5, currency: "USD" }],
    ["zero", { amount: 0, currency: "USD" }],
    ["another currency", { amount: 100, currency: "EUR" }],
  ])("rejects %s", (_case, price) => {
    expect(priceSchema.safeParse(price).success).toBe(false);
  });
});

describe("checkoutSchema", () => {
  it("defaults the buyer's language to English", () => {
    expect(checkoutSchema.parse({ courseSlug: "intro", method: "stripe" })).toEqual({ courseSlug: "intro", method: "stripe", locale: "en" });
  });

  it("keeps Khmer and rejects a language the app does not speak", () => {
    expect(checkoutSchema.parse({ courseSlug: "intro", method: "stripe", locale: "km" }).locale).toBe("km");
    expect(checkoutSchema.safeParse({ courseSlug: "intro", method: "stripe", locale: "fr" }).success).toBe(false);
  });
});

describe("couponSchema", () => {
  it("normalizes the code to upper case and defaults to no expiry or limit", () => {
    expect(couponSchema.parse({ code: " save-20 ", kind: "percent", percentOff: 20 })).toEqual({
      code: "SAVE-20",
      kind: "percent",
      percentOff: 20,
      expiresAt: null,
      maxRedemptions: null,
    });
  });

  it("reads the expiry from an ISO date", () => {
    const coupon = couponSchema.parse({ code: "LAUNCH", kind: "fixed", amountOff: 500, currency: "USD", expiresAt: "2026-12-31T00:00:00Z" });

    expect(coupon.expiresAt).toEqual(new Date("2026-12-31T00:00:00Z"));
  });

  it.each([
    ["100 percent off", { code: "FREE", kind: "percent", percentOff: 100 }],
    ["a fixed coupon without a currency", { code: "TEN", kind: "fixed", amountOff: 1000 }],
    ["a fraction of a riel", { code: "RIEL", kind: "fixed", amountOff: 150, currency: "KHR" }],
    ["a code with spaces", { code: "SAVE 20", kind: "percent", percentOff: 20 }],
    ["a two-letter code", { code: "AB", kind: "percent", percentOff: 20 }],
    ["a usage limit of zero", { code: "ZERO", kind: "percent", percentOff: 20, maxRedemptions: 0 }],
  ])("rejects %s", (_case, coupon) => {
    expect(couponSchema.safeParse(coupon).success).toBe(false);
  });
});

describe("checkoutSchema coupon", () => {
  it("normalizes the coupon code the student typed", () => {
    expect(checkoutSchema.parse({ courseSlug: "intro", method: "stripe", couponCode: "save20" }).couponCode).toBe("SAVE20");
  });
});
