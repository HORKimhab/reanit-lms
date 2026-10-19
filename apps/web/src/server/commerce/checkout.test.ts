// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError, RedirectError } from "@/test/navigation";

import { checkoutPath, getDiscount, getOffer, getOrder, ordersPath } from "./checkout";

vi.mock("next/headers", () => import("@/test/headers"));

const ORDER_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a05";
const OFFER_ROUTE = "GET /schools/by-subdomain/angkor/courses/brand/offer";
const ORDER_ROUTE = `GET /schools/by-subdomain/angkor/orders/${ORDER_ID}`;

describe("getOffer", () => {
  it("returns the course's price and methods", async () => {
    const offer = { price: { amount: 2_000_000, currency: "KHR" }, methods: ["aba_payway", "bakong_khqr"] };
    onApi(OFFER_ROUTE, Response.json({ ...offer, discount: null }));

    expect(await getOffer("angkor", "brand")).toEqual(offer);
  });

  it("404s on an unknown course", async () => {
    onApi(OFFER_ROUTE, problem(404));

    await expect(getOffer("angkor", "brand")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("bundle offers", () => {
  it("asks for a bundle's offer and discount on its own route", async () => {
    const discount = { code: "KIT10", amountOff: 990, total: 8910 };
    onApi("GET /schools/by-subdomain/angkor/bundles/kit/offer", Response.json({ price: { amount: 9900, currency: "USD" }, methods: ["stripe"], discount }));

    expect(await getOffer("angkor", "kit", "bundle")).toEqual({ price: { amount: 9900, currency: "USD" }, methods: ["stripe"] });
    expect(await getDiscount("angkor", "kit", "KIT10", "bundle")).toEqual(discount);
  });
});

describe("checkoutPath", () => {
  it("puts course and bundle checkouts under the school", () => {
    expect(checkoutPath("angkor", "course", "brand")).toBe("/s/angkor/checkout/brand");
    expect(checkoutPath("angkor", "bundle", "kit")).toBe("/s/angkor/bundle-checkout/kit");
  });
});

describe("getDiscount", () => {
  it("returns what the coupon takes off", async () => {
    const discount = { code: "SAVE20", amountOff: 400_000, total: 1_600_000 };
    onApi(OFFER_ROUTE, Response.json({ price: { amount: 2_000_000, currency: "KHR" }, methods: ["bakong_khqr"], discount }));

    expect(await getDiscount("angkor", "brand", "SAVE20")).toEqual(discount);
  });

  it("returns null for a coupon the API refuses", async () => {
    onApi(OFFER_ROUTE, problem(400, "urn:reanit:problem:invalid-coupon"));

    expect(await getDiscount("angkor", "brand", "OLD20")).toBeNull();
  });

  it("404s on an unknown course", async () => {
    onApi(OFFER_ROUTE, problem(404));

    await expect(getDiscount("angkor", "brand", "SAVE20")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("getOrder", () => {
  it("returns the buyer's order", async () => {
    const order = { id: ORDER_ID, status: "pending", courseId: ORDER_ID, amount: 4900, currency: "USD", method: "stripe" };
    onApi(ORDER_ROUTE, Response.json({ order }));

    expect(await getOrder("angkor", ORDER_ID)).toEqual(order);
  });

  it("sends a signed-out visitor to log in and back to the order", async () => {
    onApi(ORDER_ROUTE, problem(401));

    await expect(getOrder("angkor", ORDER_ID)).rejects.toEqual(new RedirectError(`/login?next=%2Fs%2Fangkor%2Forders%2F${ORDER_ID}`));
  });
});

describe("ordersPath", () => {
  it("puts orders under the school", () => {
    expect(ordersPath("angkor")).toBe("/s/angkor/orders");
  });
});
