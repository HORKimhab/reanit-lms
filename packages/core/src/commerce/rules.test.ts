import { describe, expect, it } from "vitest";

import { bundleCheckoutSchema, checkoutSchema, couponSchema, createBundleSchema, priceSchema, updateBundleSchema } from "./rules";

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

describe("createBundleSchema", () => {
  const COURSES = ["0b9a6d1e-5c3f-4a2b-9e8d-7c6b5a4f3e21", "0b9a6d1e-5c3f-4a2b-9e8d-7c6b5a4f3e22"];

  it("accepts a title and two or more courses", () => {
    expect(createBundleSchema.parse({ title: "  Design kit ", courseIds: COURSES })).toEqual({ title: "Design kit", courseIds: COURSES });
  });

  it.each([
    ["a single course", { title: "Kit", courseIds: [COURSES[0]] }],
    ["the same course twice", { title: "Kit", courseIds: [COURSES[0], COURSES[0]] }],
    ["a blank title", { title: "  ", courseIds: COURSES }],
    ["a course id that is not a UUID", { title: "Kit", courseIds: [COURSES[0], "intro"] }],
  ])("rejects %s", (_case, bundle) => {
    expect(createBundleSchema.safeParse(bundle).success).toBe(false);
  });
});

describe("updateBundleSchema", () => {
  it("accepts just a status, leaving the rest as it is", () => {
    expect(updateBundleSchema.parse({ status: "published" })).toEqual({ status: "published" });
  });
});

describe("bundleCheckoutSchema", () => {
  it("takes a bundle instead of a course, with the same method, coupon and language", () => {
    expect(bundleCheckoutSchema.parse({ bundleSlug: "kit", method: "stripe", couponCode: "save20" })).toEqual({
      bundleSlug: "kit",
      method: "stripe",
      couponCode: "SAVE20",
      locale: "en",
    });
  });
});
