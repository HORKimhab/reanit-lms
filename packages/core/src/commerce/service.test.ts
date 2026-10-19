import { beforeEach, describe, expect, it } from "vitest";

import { CourseNotFoundError } from "../catalog";
import { FakeClock } from "../test/auth-fakes";
import { AskableFakeGateway, FakeCommerceStore, FakeConfirmationStore, FakeGateway } from "../test/commerce-fakes";
import {
  AlreadyEnrolledError,
  CouponCodeTakenError,
  CouponNotFoundError,
  CourseNotForSaleError,
  InvalidCouponError,
  OrderNotFoundError,
  PaymentMethodUnavailableError,
  UnknownPaymentError,
} from "./errors";
import { createCommerceService, createPaymentConfirmation, type CommerceService } from "./service";

const BUYER = { userId: "user-1", email: "dara@example.com" };
const NOW = new Date("2026-10-19T12:00:00Z");
const SAVE20 = { code: "SAVE20", kind: "percent", percentOff: 20, expiresAt: null, maxRedemptions: null } as const;

/**
 * Builds the return URLs for an order.
 *
 * @param orderId The order.
 * @returns Success and cancel URLs naming it.
 */
function urls(orderId: string) {
  return { successUrl: `https://app.test/orders/${orderId}`, cancelUrl: `https://app.test/orders/${orderId}?cancelled` };
}

let store: FakeCommerceStore;
let stripe: FakeGateway;
let khqr: AskableFakeGateway;
let commerce: CommerceService;

beforeEach(() => {
  store = new FakeCommerceStore();
  store.courses.set("c1", { id: "c1", slug: "intro", title: "Intro", isPublished: true, price: { id: "p1", amount: 4900, currency: "USD" } });
  store.courses.set("c2", { id: "c2", slug: "riel", title: "Riel course", isPublished: true, price: { id: "p2", amount: 20000, currency: "KHR" } });
  store.courses.set("c3", { id: "c3", slug: "free", title: "No price", isPublished: true, price: null });
  store.courses.set("c4", { id: "c4", slug: "draft", title: "Draft", isPublished: false, price: { id: "p4", amount: 100, currency: "USD" } });
  stripe = new FakeGateway("stripe", ["USD"]);
  khqr = new AskableFakeGateway("bakong_khqr", ["USD", "KHR"]);
  commerce = createCommerceService({
    store,
    gateways: [stripe, khqr],
    confirmation: createPaymentConfirmation(new FakeConfirmationStore(store)),
    clock: new FakeClock(NOW),
  });
});

describe("getOffer", () => {
  it("offers every configured method that takes the course's currency", async () => {
    expect(await commerce.getOffer("intro")).toEqual({
      price: { id: "p1", amount: 4900, currency: "USD" },
      methods: ["stripe", "bakong_khqr"],
      discount: null,
    });
    expect((await commerce.getOffer("riel")).methods).toEqual(["bakong_khqr"]);
  });

  it("offers nothing for a course without a price", async () => {
    expect(await commerce.getOffer("free")).toEqual({ price: null, methods: [], discount: null });
  });

  it("prices the course with the coupon the student typed", async () => {
    await commerce.createCoupon(SAVE20);

    expect((await commerce.getOffer("intro", { coupon: "SAVE20" })).discount).toEqual({ code: "SAVE20", amountOff: 980, total: 3920 });
  });

  it("throws InvalidCouponError for a code the school does not have", async () => {
    await expect(commerce.getOffer("intro", { coupon: "NOPE" })).rejects.toThrow(InvalidCouponError);
  });

  it("throws CourseNotFoundError for a draft or missing course", async () => {
    await expect(commerce.getOffer("draft")).rejects.toThrow(CourseNotFoundError);
    await expect(commerce.getOffer("missing")).rejects.toThrow(CourseNotFoundError);
  });
});

describe("setPrice", () => {
  it("sets a course's price", async () => {
    expect(await commerce.setPrice("c3", { amount: 1500, currency: "USD" })).toMatchObject({ amount: 1500, currency: "USD" });
  });

  it("throws CourseNotFoundError for another school's or a missing course", async () => {
    await expect(commerce.setPrice("missing", { amount: 1, currency: "USD" })).rejects.toThrow(CourseNotFoundError);
  });
});

describe("checkout", () => {
  it("records the language the buyer checked out in, for their emails", async () => {
    await commerce.checkout(BUYER, { courseSlug: "intro", method: "stripe", locale: "km" }, urls);

    expect(store.orders[0]?.locale).toBe("km");
  });

  it("creates a pending order at the course's price and starts the chosen gateway", async () => {
    const result = await commerce.checkout(BUYER, { courseSlug: "intro", method: "stripe", locale: "en" }, urls);

    expect(result).toEqual({ orderId: "order-1", payment: { kind: "redirect", url: "https://pay.test/order-1", providerRef: "ref-order-1" } });
    expect(store.orders[0]).toMatchObject({ status: "pending", amount: 4900, currency: "USD", method: "stripe", locale: "en", providerRef: "ref-order-1" });
    expect(stripe.requests).toEqual([
      { orderId: "order-1", amount: 4900, currency: "USD", description: "Intro", customerEmail: BUYER.email, ...urls("order-1") },
    ]);
    expect(store.enrollments.size).toBe(0);
  });

  it("throws PaymentMethodUnavailableError for a method that does not take the currency or is not configured", async () => {
    await expect(commerce.checkout(BUYER, { courseSlug: "riel", method: "stripe", locale: "en" }, urls)).rejects.toThrow(PaymentMethodUnavailableError);
    await expect(commerce.checkout(BUYER, { courseSlug: "intro", method: "aba_payway", locale: "en" }, urls)).rejects.toThrow(PaymentMethodUnavailableError);
    expect(store.orders).toEqual([]);
  });

  it("throws CourseNotForSaleError for a course without a price", async () => {
    await expect(commerce.checkout(BUYER, { courseSlug: "free", method: "stripe", locale: "en" }, urls)).rejects.toThrow(CourseNotForSaleError);
  });

  it("throws CourseNotFoundError for a draft", async () => {
    await expect(commerce.checkout(BUYER, { courseSlug: "draft", method: "stripe", locale: "en" }, urls)).rejects.toThrow(CourseNotFoundError);
  });

  it("throws AlreadyEnrolledError when the student has the course", async () => {
    store.enrollments.add("user-1:c1");

    await expect(commerce.checkout(BUYER, { courseSlug: "intro", method: "stripe", locale: "en" }, urls)).rejects.toThrow(AlreadyEnrolledError);
    expect(store.orders).toEqual([]);
  });
});

describe("checkout with a coupon", () => {
  it("charges the price less the coupon and records the coupon on the order", async () => {
    await commerce.createCoupon(SAVE20);

    await commerce.checkout(BUYER, { courseSlug: "intro", method: "stripe", couponCode: "SAVE20", locale: "en" }, urls);

    expect(stripe.requests[0]?.amount).toBe(3920);
    expect(store.orders[0]).toMatchObject({ amount: 3920, currency: "USD", couponId: "coupon-1" });
  });

  it("counts only paid orders towards the usage limit", async () => {
    await commerce.createCoupon({ ...SAVE20, maxRedemptions: 1 });
    await commerce.checkout(BUYER, { courseSlug: "intro", method: "stripe", couponCode: "SAVE20", locale: "en" }, urls);
    await commerce.checkout({ userId: "user-2", email: "b@example.com" }, { courseSlug: "intro", method: "stripe", couponCode: "SAVE20", locale: "en" }, urls);
    await createPaymentConfirmation(new FakeConfirmationStore(store)).confirm("stripe", "ref-order-1");

    await expect(
      commerce.checkout({ userId: "user-3", email: "c@example.com" }, { courseSlug: "intro", method: "stripe", couponCode: "SAVE20", locale: "en" }, urls),
    ).rejects.toThrow(InvalidCouponError);
    expect(store.orders).toHaveLength(2);
  });

  it("throws InvalidCouponError and creates no order for an expired coupon", async () => {
    await commerce.createCoupon({ ...SAVE20, expiresAt: NOW });

    await expect(commerce.checkout(BUYER, { courseSlug: "intro", method: "stripe", couponCode: "SAVE20", locale: "en" }, urls)).rejects.toThrow(
      InvalidCouponError,
    );
    expect(store.orders).toEqual([]);
  });
});

describe("coupons", () => {
  it("creates a coupon and lists it with no uses yet", async () => {
    const coupon = await commerce.createCoupon(SAVE20);

    expect(coupon).toEqual({ ...SAVE20, id: "coupon-1", redemptions: 0 });
    expect(await commerce.listCoupons()).toEqual([coupon]);
  });

  it("throws CouponCodeTakenError for a code the school already uses", async () => {
    await commerce.createCoupon(SAVE20);

    await expect(commerce.createCoupon({ ...SAVE20, percentOff: 50 })).rejects.toThrow(CouponCodeTakenError);
  });

  it("deletes a coupon so it can no longer be used", async () => {
    const { id } = await commerce.createCoupon(SAVE20);

    await commerce.deleteCoupon(id);

    await expect(commerce.getOffer("intro", { coupon: "SAVE20" })).rejects.toThrow(InvalidCouponError);
  });

  it("throws CouponNotFoundError when deleting an unknown coupon", async () => {
    await expect(commerce.deleteCoupon("missing")).rejects.toThrow(CouponNotFoundError);
  });
});

describe("getOrder", () => {
  it("returns the buyer's order and hides it from others", async () => {
    await commerce.checkout(BUYER, { courseSlug: "intro", method: "stripe", locale: "en" }, urls);

    expect(await commerce.getOrder("order-1", "user-1")).toMatchObject({ id: "order-1", status: "pending" });
    await expect(commerce.getOrder("order-1", "user-2")).rejects.toThrow(OrderNotFoundError);
  });
});

describe("getOrder with a gateway that can be asked", () => {
  it("asks the gateway about a pending order and enrolls once it is paid", async () => {
    const { orderId } = await commerce.checkout(BUYER, { courseSlug: "riel", method: "bakong_khqr", locale: "en" }, urls);
    khqr.checkResult = "paid";

    expect((await commerce.getOrder(orderId, "user-1")).status).toBe("paid");
    expect(khqr.checked).toEqual([`ref-${orderId}`]);
    expect(store.enrollments).toEqual(new Set(["user-1:c2"]));
  });

  it("leaves a still-pending order pending and enrolls nobody", async () => {
    const { orderId } = await commerce.checkout(BUYER, { courseSlug: "riel", method: "bakong_khqr", locale: "en" }, urls);

    expect((await commerce.getOrder(orderId, "user-1")).status).toBe("pending");
    expect(store.enrollments.size).toBe(0);
  });

  it("does not ask again once the order is paid", async () => {
    const { orderId } = await commerce.checkout(BUYER, { courseSlug: "riel", method: "bakong_khqr", locale: "en" }, urls);
    khqr.checkResult = "paid";
    await commerce.getOrder(orderId, "user-1");

    await commerce.getOrder(orderId, "user-1");

    expect(khqr.checked).toHaveLength(1);
  });

  it("never asks a gateway that only pushes (Stripe)", async () => {
    const { orderId } = await commerce.checkout(BUYER, { courseSlug: "intro", method: "stripe", locale: "en" }, urls);

    expect((await commerce.getOrder(orderId, "user-1")).status).toBe("pending");
  });
});

describe("payment confirmation", () => {
  it("marks the order paid and enrolls the buyer exactly once", async () => {
    await commerce.checkout(BUYER, { courseSlug: "intro", method: "stripe", locale: "en" }, urls);
    const confirmation = createPaymentConfirmation(new FakeConfirmationStore(store));

    expect(await confirmation.confirm("stripe", "ref-order-1")).toEqual({ orderId: "order-1", isNewlyPaid: true });
    expect(await confirmation.confirm("stripe", "ref-order-1")).toEqual({ orderId: "order-1", isNewlyPaid: false });
    expect(store.enrollments).toEqual(new Set(["user-1:c1"]));
  });

  it("throws UnknownPaymentError for a reference no order has", async () => {
    const confirmation = createPaymentConfirmation(new FakeConfirmationStore(store));

    await expect(confirmation.confirm("stripe", "ref-nope")).rejects.toThrow(UnknownPaymentError);
  });
});
