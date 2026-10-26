import { beforeEach, describe, expect, it } from "vitest";

import { CourseNotFoundError } from "../catalog";
import type { CreatorPlan } from "../schools";
import { FakeClock } from "../test/auth-fakes";
import { AskableFakeGateway, FakeCommerceStore, FakeConfirmationStore, FakeGateway, RefundingFakeGateway } from "../test/commerce-fakes";
import { FakePlanConfirmationStore, planGuardOn } from "../test/plan-fakes";
import {
  AlreadyEnrolledError,
  BundleNotFoundError,
  CouponCodeTakenError,
  CouponNotFoundError,
  CourseNotForSaleError,
  InvalidCouponError,
  OfflinePaymentClosedError,
  OrderNotFoundError,
  OrderNotRefundableError,
  PaymentMethodUnavailableError,
  RefundByHandRequiredError,
  SubscriptionNotFoundError,
  SubscriptionNotRenewableError,
  UnknownBundleCourseError,
  UnknownPaymentError,
} from "./errors";
import { createCommerceService, createPaymentConfirmation, type CommerceService } from "./service";
import type { PaymentGateway } from "./ports";
import { renewSubscription } from "./subscriptions";

const BUYER = { userId: "user-1", email: "dara@example.com" };
const NOW = new Date("2026-10-19T12:00:00Z");
const SAVE20 = { code: "SAVE20", kind: "percent", percentOff: 20, expiresAt: null, maxRedemptions: null } as const;
const ONE_TIME = { kind: "one_time" } as const;

/**
 * Builds the return URLs for an order.
 *
 * @param orderId The order.
 * @returns Success and cancel URLs naming it.
 */
function urls(orderId: string) {
  return { successUrl: `https://app.test/orders/${orderId}`, cancelUrl: `https://app.test/orders/${orderId}?cancelled` };
}

/**
 * Builds the school's selling use cases over the test store, with confirmation through the fakes.
 *
 * @param gateways The configured gateways.
 * @param options What to vary.
 * @param options.plan The school's plan; Business by default, which limits nothing.
 * @param options.clock The clock; fixed at `NOW` by default.
 * @returns The service.
 */
function commerceWith(gateways: PaymentGateway[], { plan = "business", clock = new FakeClock(NOW) }: { plan?: CreatorPlan; clock?: FakeClock } = {}) {
  return createCommerceService({
    store,
    gateways,
    confirmation: createPaymentConfirmation({ store: new FakeConfirmationStore(store), plans: new FakePlanConfirmationStore(), clock }),
    clock,
    plan: planGuardOn(plan),
  });
}

let store: FakeCommerceStore;
let stripe: FakeGateway;
let khqr: AskableFakeGateway;
let commerce: CommerceService;

beforeEach(() => {
  store = new FakeCommerceStore();
  store.courses.set("c1", { id: "c1", slug: "intro", title: "Intro", isPublished: true, price: { id: "p1", amount: 4900, currency: "USD", billing: ONE_TIME } });
  store.courses.set("c2", { id: "c2", slug: "riel", title: "Riel course", isPublished: true, price: { id: "p2", amount: 20000, currency: "KHR", billing: ONE_TIME } });
  store.courses.set("c3", { id: "c3", slug: "free", title: "No price", isPublished: true, price: null });
  store.courses.set("c4", { id: "c4", slug: "draft", title: "Draft", isPublished: false, price: { id: "p4", amount: 100, currency: "USD", billing: ONE_TIME } });
  stripe = new FakeGateway("stripe", ["USD"]);
  khqr = new AskableFakeGateway("bakong_khqr", ["USD", "KHR"]);
  commerce = commerceWith([stripe, khqr]);
});

describe("getOffer", () => {
  it("offers every configured method that takes the course's currency", async () => {
    expect(await commerce.getOffer("intro")).toEqual({
      price: { id: "p1", amount: 4900, currency: "USD", billing: ONE_TIME },
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

describe("getPrice", () => {
  it("reads a draft course's price, and null for a course without one", async () => {
    expect(await commerce.getPrice("c4")).toEqual({ id: "p4", amount: 100, currency: "USD", billing: ONE_TIME });
    expect(await commerce.getPrice("c3")).toBeNull();
  });

  it("throws CourseNotFoundError for a course the school does not have", async () => {
    await expect(commerce.getPrice("missing")).rejects.toThrow(CourseNotFoundError);
  });
});

describe("setPrice", () => {
  it("sets a course's price", async () => {
    expect(await commerce.setPrice("c3", { amount: 1500, currency: "USD", billing: ONE_TIME })).toMatchObject({ amount: 1500, currency: "USD" });
  });

  it("throws CourseNotFoundError for another school's or a missing course", async () => {
    await expect(commerce.setPrice("missing", { amount: 1, currency: "USD", billing: ONE_TIME })).rejects.toThrow(CourseNotFoundError);
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
    store.enroll("user-1", "c1");

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
    await createPaymentConfirmation({ store: new FakeConfirmationStore(store), plans: new FakePlanConfirmationStore(), clock: new FakeClock(NOW) }).confirm("stripe", "ref-order-1");

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

describe("bundles", () => {
  /**
   * Creates a published bundle of the intro and advanced courses at a USD price.
   *
   * @param price The bundle's price, in USD cents.
   * @returns The bundle's id and slug.
   */
  async function publishedBundle(price = 10_000) {
    store.courses.set("c5", { id: "c5", slug: "advanced", title: "Advanced", isPublished: true, price: { id: "p5", amount: 7900, currency: "USD", billing: ONE_TIME } });
    const bundle = await commerce.createBundle({ title: "Design Kit", courseIds: ["c1", "c5"] });
    await commerce.updateBundle(bundle.id, { status: "published" });
    await commerce.setBundlePrice(bundle.id, { amount: price, currency: "USD", billing: ONE_TIME });
    return bundle;
  }

  it("creates a draft bundle of the school's courses with a slug from its title, numbered when taken", async () => {
    const first = await commerce.createBundle({ title: "Design Kit", courseIds: ["c1", "c3"] });
    const second = await commerce.createBundle({ title: "Design Kit", courseIds: ["c3", "c1"] });

    expect(first).toMatchObject({ slug: "design-kit", status: "draft", price: null, courses: [{ id: "c1" }, { id: "c3" }] });
    expect(second.slug).toBe("design-kit-2");
    expect(await commerce.listBundles()).toEqual([second, first]);
  });

  it("throws UnknownBundleCourseError for a course the school does not have", async () => {
    await expect(commerce.createBundle({ title: "Kit", courseIds: ["c1", "other-school"] })).rejects.toThrow(UnknownBundleCourseError);
    const { id } = await commerce.createBundle({ title: "Kit", courseIds: ["c1", "c3"] });
    await expect(commerce.updateBundle(id, { courseIds: ["c1", "other-school"] })).rejects.toThrow(UnknownBundleCourseError);
  });

  it("throws BundleNotFoundError when changing or pricing a bundle the school does not have", async () => {
    await expect(commerce.updateBundle("missing", { title: "Kit" })).rejects.toThrow(BundleNotFoundError);
    await expect(commerce.setBundlePrice("missing", { amount: 100, currency: "USD", billing: ONE_TIME })).rejects.toThrow(BundleNotFoundError);
    await expect(commerce.getBundle("missing")).rejects.toThrow(BundleNotFoundError);
  });

  it("shows a draft bundle to the school's staff but not to students", async () => {
    await commerce.createBundle({ title: "Draft Kit", courseIds: ["c1", "c3"] });

    expect((await commerce.getBundle("draft-kit")).status).toBe("draft");
    await expect(commerce.getPublishedBundle("draft-kit")).rejects.toThrow(BundleNotFoundError);
    await expect(commerce.getBundleOffer("draft-kit")).rejects.toThrow(BundleNotFoundError);
  });

  it("offers a published bundle at its price, with a coupon's discount", async () => {
    const { slug } = await publishedBundle();
    await commerce.createCoupon(SAVE20);

    expect(await commerce.getBundleOffer(slug, { coupon: "SAVE20" })).toEqual({
      price: { id: expect.any(String), amount: 10_000, currency: "USD", billing: ONE_TIME },
      methods: ["stripe", "bakong_khqr"],
      discount: { code: "SAVE20", amountOff: 2000, total: 8000 },
    });
  });

  it("sells every course in one order at the bundle's price split across them, and enrolls in all on payment", async () => {
    const { id, slug } = await publishedBundle(10_001);

    const { orderId } = await commerce.checkoutBundle(BUYER, { bundleSlug: slug, method: "stripe", locale: "en" }, urls);

    expect(stripe.requests[0]).toMatchObject({ amount: 10_001, description: "Design Kit" });
    expect(store.orders[0]).toMatchObject({ bundleId: id, amount: 10_001, lines: [{ courseId: "c1", amount: 5001 }, { courseId: "c5", amount: 5000 }] });
    await createPaymentConfirmation({ store: new FakeConfirmationStore(store), plans: new FakePlanConfirmationStore(), clock: new FakeClock(NOW) }).confirm("stripe", `ref-${orderId}`);
    expect(store.enrollments).toEqual(new Map([["user-1:c1", null], ["user-1:c5", null]]));
  });

  it("sells a bundle to a student who has some of its courses, not all", async () => {
    const { slug } = await publishedBundle();
    store.enroll("user-1", "c1");

    await commerce.checkoutBundle(BUYER, { bundleSlug: slug, method: "stripe", locale: "en" }, urls);
    store.enroll("user-1", "c5");

    await expect(commerce.checkoutBundle(BUYER, { bundleSlug: slug, method: "stripe", locale: "en" }, urls)).rejects.toThrow(AlreadyEnrolledError);
  });

  it("throws CourseNotForSaleError for a published bundle without a price", async () => {
    const { id, slug } = await commerce.createBundle({ title: "Free Kit", courseIds: ["c1", "c3"] });
    await commerce.updateBundle(id, { status: "published" });

    await expect(commerce.checkoutBundle(BUYER, { bundleSlug: slug, method: "stripe", locale: "en" }, urls)).rejects.toThrow(CourseNotForSaleError);
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
    expect(store.enrollments).toEqual(new Map([["user-1:c2", null]]));
  });

  it("fails an order the gateway says will not be paid", async () => {
    const { orderId } = await commerce.checkout(BUYER, { courseSlug: "riel", method: "bakong_khqr", locale: "en" }, urls);
    khqr.checkResult = "failed";

    expect((await commerce.getOrder(orderId, "user-1")).status).toBe("failed");
    expect(store.orders[0]?.status).toBe("failed");
    expect(store.enrollments.size).toBe(0);
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
    const confirmation = createPaymentConfirmation({ store: new FakeConfirmationStore(store), plans: new FakePlanConfirmationStore(), clock: new FakeClock(NOW) });

    expect(await confirmation.confirm("stripe", "ref-order-1")).toEqual({ orderId: "order-1", isNewlyPaid: true });
    expect(await confirmation.confirm("stripe", "ref-order-1")).toEqual({ orderId: "order-1", isNewlyPaid: false });
    expect(store.enrollments).toEqual(new Map([["user-1:c1", null]]));
  });

  it("throws UnknownPaymentError for a reference no order has", async () => {
    const confirmation = createPaymentConfirmation({ store: new FakeConfirmationStore(store), plans: new FakePlanConfirmationStore(), clock: new FakeClock(NOW) });

    await expect(confirmation.confirm("stripe", "ref-nope")).rejects.toThrow(UnknownPaymentError);
  });
});

describe("refundOrder", () => {
  let refundingStripe: RefundingFakeGateway;
  let refunds: CommerceService;

  beforeEach(() => {
    refundingStripe = new RefundingFakeGateway("stripe", ["USD"]);
    refunds = commerceWith([refundingStripe, khqr]);
  });

  /**
   * Buys a course and confirms its payment.
   *
   * @param courseSlug The course.
   * @param method The gateway.
   * @returns The paid order's id.
   */
  async function paidOrder(courseSlug: string, method: "stripe" | "bakong_khqr") {
    const { orderId } = await refunds.checkout(BUYER, { courseSlug, method, locale: "en" }, urls);
    await new FakeConfirmationStore(store).confirm({ method, providerRef: `ref-${orderId}` }, NOW, renewSubscription);
    return orderId;
  }

  it("refunds through a gateway that can, and takes the course back", async () => {
    const orderId = await paidOrder("intro", "stripe");

    await refunds.refundOrder(orderId, { isRefundedByHand: false });

    expect(refundingStripe.refunded).toEqual([`ref-${orderId}`]);
    expect(store.orders[0]).toMatchObject({ status: "refunded", refund: { at: NOW, isRefundedByHand: false } });
    expect(store.enrollments.size).toBe(0);
  });

  it("records a refund the gateway made as not by hand, whatever staff said", async () => {
    const orderId = await paidOrder("intro", "stripe");

    await refunds.refundOrder(orderId, { isRefundedByHand: true });

    expect(refundingStripe.refunded).toEqual([`ref-${orderId}`]);
    expect(store.orders[0]?.refund?.isRefundedByHand).toBe(false);
  });

  it("throws RefundByHandRequiredError for a gateway that cannot refund until staff refunded by hand", async () => {
    const orderId = await paidOrder("riel", "bakong_khqr");

    await expect(refunds.refundOrder(orderId, { isRefundedByHand: false })).rejects.toThrow(RefundByHandRequiredError);
    expect(store.orders[0]?.status).toBe("paid");

    await refunds.refundOrder(orderId, { isRefundedByHand: true });
    expect(store.orders[0]).toMatchObject({ status: "refunded", refund: { isRefundedByHand: true } });
  });

  it("keeps the order paid when the gateway refuses the refund", async () => {
    const orderId = await paidOrder("intro", "stripe");
    refundingStripe.failure = new Error("charge disputed");

    await expect(refunds.refundOrder(orderId, { isRefundedByHand: false })).rejects.toThrow("charge disputed");
    expect(store.orders[0]?.status).toBe("paid");
  });

  it.each(["pending", "refunded"])("throws OrderNotRefundableError for a %s order", async (status) => {
    const { orderId } = await refunds.checkout(BUYER, { courseSlug: "intro", method: "stripe", locale: "en" }, urls);
    store.orders[0]!.status = status as "pending" | "refunded"; // checkout stored the order

    await expect(refunds.refundOrder(orderId, { isRefundedByHand: true })).rejects.toThrow(OrderNotRefundableError);
    expect(refundingStripe.refunded).toEqual([]);
  });

  it("throws OrderNotFoundError for an order the school does not have", async () => {
    await expect(refunds.refundOrder("order-404", { isRefundedByHand: true })).rejects.toThrow(OrderNotFoundError);
  });
});

describe("subscriptions and payment plans", () => {
  const MONTHLY = { kind: "recurring", interval: "month" } as const;
  let payway: AskableFakeGateway;
  let plans: CommerceService;
  let clock: FakeClock;

  beforeEach(() => {
    store.courses.set("c6", { id: "c6", slug: "club", title: "Design Club", isPublished: true, price: { id: "p6", amount: 1500, currency: "USD", billing: MONTHLY } });
    store.courses.set("c7", {
      id: "c7",
      slug: "plan",
      title: "Pro Course",
      isPublished: true,
      price: { id: "p7", amount: 10_000, currency: "USD", billing: { kind: "payment_plan", installments: 2 } },
    });
    store.hasQr = true;
    payway = new AskableFakeGateway("aba_payway", ["USD", "KHR"]);
    clock = new FakeClock(NOW);
    plans = commerceWith([stripe, payway], { clock });
  });

  /**
   * Starts the student's subscription to a course and has PayWay confirm its first payment.
   *
   * @param courseSlug The monthly course or the payment plan course.
   */
  async function payFirstPeriod(courseSlug: "club" | "plan") {
    const { orderId } = await plans.checkout(BUYER, { courseSlug, method: "aba_payway", locale: "en" }, urls);
    payway.checkResult = "paid";
    await plans.getOrder(orderId, "user-1");
  }

  it("offers the school's payment QR first, then the gateways that bill period by period, never Stripe", async () => {
    expect((await plans.getOffer("club")).methods).toEqual(["offline_qr", "aba_payway"]);
    expect((await plans.getOffer("intro")).methods).toEqual(["stripe", "aba_payway"]);
  });

  it("leaves out the payment QR until the school uploads one", async () => {
    store.hasQr = false;

    expect((await plans.getOffer("club")).methods).toEqual(["aba_payway"]);
  });

  it("refuses Stripe and coupons for a subscription", async () => {
    await plans.createCoupon(SAVE20);

    await expect(plans.checkout(BUYER, { courseSlug: "club", method: "stripe", locale: "en" }, urls)).rejects.toThrow(PaymentMethodUnavailableError);
    await expect(plans.getOffer("club", { coupon: "SAVE20" })).rejects.toThrow(new InvalidCouponError("one_time_only"));
    expect(store.subscriptions).toHaveLength(0);
  });

  it("starts a pending subscription whose first order pays the first period, and gives access until a week after it", async () => {
    const { orderId } = await plans.checkout(BUYER, { courseSlug: "club", method: "aba_payway", locale: "en" }, urls);
    expect(store.subscriptions[0]).toMatchObject({ id: "subscription-1", status: "pending", paidPeriods: 0 });
    expect(store.orders[0]).toMatchObject({ id: orderId, subscriptionId: "subscription-1", amount: 1500 });

    payway.checkResult = "paid";
    await plans.getOrder(orderId, "user-1");

    expect(store.subscriptions[0]).toMatchObject({ status: "active", paidPeriods: 1, currentPeriodEnd: new Date("2026-11-19T12:00:00Z") });
    expect(store.enrollments.get("user-1:c6")).toEqual(new Date("2026-11-26T12:00:00Z"));
  });

  it("renews a subscription at its price, extending access from the end of the paid period", async () => {
    await payFirstPeriod("club");

    const renewal = await plans.renewSubscription(BUYER, "subscription-1", { method: "aba_payway", locale: "km" }, urls);
    await plans.getOrder(renewal.orderId, "user-1");

    expect(store.orders[1]).toMatchObject({ subscriptionId: "subscription-1", amount: 1500, locale: "km" });
    expect(store.subscriptions[0]).toMatchObject({ paidPeriods: 2, currentPeriodEnd: new Date("2026-12-19T12:00:00Z") });
    expect(store.enrollments.get("user-1:c6")).toEqual(new Date("2026-12-26T12:00:00Z"));
  });

  it("completes a payment plan on its last instalment and keeps the course for good", async () => {
    await payFirstPeriod("plan");
    const second = await plans.renewSubscription(BUYER, "subscription-1", { method: "aba_payway", locale: "en" }, urls);
    await plans.getOrder(second.orderId, "user-1");

    expect(store.subscriptions[0]?.status).toBe("completed");
    expect(store.enrollments.get("user-1:c7")).toBeNull();
    await expect(plans.renewSubscription(BUYER, "subscription-1", { method: "aba_payway", locale: "en" }, urls)).rejects.toThrow(SubscriptionNotRenewableError);
  });

  it("refuses to renew before the first payment, and another student's subscription", async () => {
    await plans.checkout(BUYER, { courseSlug: "club", method: "aba_payway", locale: "en" }, urls);

    await expect(plans.renewSubscription(BUYER, "subscription-1", { method: "aba_payway", locale: "en" }, urls)).rejects.toThrow(SubscriptionNotRenewableError);
    await expect(plans.renewSubscription({ userId: "user-2", email: "x@example.com" }, "subscription-1", { method: "aba_payway", locale: "en" }, urls)).rejects.toThrow(
      SubscriptionNotFoundError,
    );
  });

  it("lets a student whose access lapsed subscribe again", async () => {
    store.enroll("user-1", "c6", new Date("2026-10-01T00:00:00Z"));

    await expect(plans.checkout(BUYER, { courseSlug: "club", method: "aba_payway", locale: "en" }, urls)).resolves.toMatchObject({ orderId: "order-1" });
  });

  it("refuses a new subscription while access lasts", async () => {
    store.enroll("user-1", "c6", new Date("2026-11-01T00:00:00Z"));

    await expect(plans.checkout(BUYER, { courseSlug: "club", method: "aba_payway", locale: "en" }, urls)).rejects.toThrow(AlreadyEnrolledError);
  });

  it("lists the student's paid subscriptions, showing one past its grace week as lapsed", async () => {
    await payFirstPeriod("club");
    await plans.checkout(BUYER, { courseSlug: "plan", method: "aba_payway", locale: "en" }, urls);
    expect((await plans.listMySubscriptions("user-1")).map(({ id, status, methods }) => [id, status, methods])).toEqual([["subscription-1", "active", ["offline_qr", "aba_payway"]]]);

    clock.advance(40 * 24 * 60 * 60 * 1000);

    expect((await plans.listMySubscriptions("user-1"))[0]?.status).toBe("lapsed");
  });
});

describe("offline QR payments", () => {
  let offline: CommerceService;

  beforeEach(() => {
    store.courses.set("c6", { id: "c6", slug: "club", title: "Design Club", isPublished: true, price: { id: "p6", amount: 1500, currency: "USD", billing: { kind: "recurring", interval: "month" } } });
    store.hasQr = true;
    offline = commerceWith([stripe]);
  });

  /**
   * Starts an offline QR order for the subscription course.
   *
   * @returns The order's id.
   */
  async function offlineOrder() {
    const { orderId, payment } = await offline.checkout(BUYER, { courseSlug: "club", method: "offline_qr", locale: "en" }, urls);
    expect(payment).toEqual({ kind: "offline" });
    return orderId;
  }

  it("refuses the offline QR for a one-time price", async () => {
    await expect(offline.checkout(BUYER, { courseSlug: "intro", method: "offline_qr", locale: "en" }, urls)).rejects.toThrow(PaymentMethodUnavailableError);
  });

  it("waits for staff once the student says they paid, and enrolls once staff confirm", async () => {
    const orderId = await offlineOrder();

    await offline.submitOfflinePayment(orderId, "user-1", { reference: "ABA-123" });
    expect(store.orders[0]).toMatchObject({ status: "awaiting_confirmation", paymentReference: "ABA-123" });
    expect(store.enrollments.size).toBe(0);

    await offline.confirmOfflinePayment(orderId);

    expect(store.orders[0]?.status).toBe("paid");
    expect(store.subscriptions[0]).toMatchObject({ status: "active", paidPeriods: 1 });
    expect(store.enrollments.has("user-1:c6")).toBe(true);
  });

  it("lets staff confirm a payment they found before the student said so", async () => {
    const orderId = await offlineOrder();

    await offline.confirmOfflinePayment(orderId);

    expect(store.orders[0]?.status).toBe("paid");
  });

  it("fails an offline payment staff reject, enrolling nobody", async () => {
    const orderId = await offlineOrder();
    await offline.submitOfflinePayment(orderId, "user-1", { reference: "ABA-123" });

    await offline.rejectOfflinePayment(orderId);

    expect(store.orders[0]?.status).toBe("failed");
    expect(store.enrollments.size).toBe(0);
    await expect(offline.rejectOfflinePayment(orderId)).rejects.toThrow(OfflinePaymentClosedError);
  });

  it("refuses to mark paid an order that is not a pending offline order of the student", async () => {
    const orderId = await offlineOrder();
    await offline.submitOfflinePayment(orderId, "user-1", { reference: "ABA-123" });

    await expect(offline.submitOfflinePayment(orderId, "user-1", { reference: "again" })).rejects.toThrow(OfflinePaymentClosedError);
    await expect(offline.submitOfflinePayment(orderId, "user-2", { reference: "ABA-123" })).rejects.toThrow(OrderNotFoundError);
  });

  it("refuses to confirm a gateway's order or one already paid", async () => {
    const { orderId: cardOrder } = await offline.checkout(BUYER, { courseSlug: "intro", method: "stripe", locale: "en" }, urls);
    const orderId = await offlineOrder();
    await offline.confirmOfflinePayment(orderId);

    await expect(offline.confirmOfflinePayment(cardOrder)).rejects.toThrow(OfflinePaymentClosedError);
    await expect(offline.confirmOfflinePayment(orderId)).rejects.toThrow(OfflinePaymentClosedError);
    await expect(offline.confirmOfflinePayment("order-404")).rejects.toThrow(OrderNotFoundError);
  });

  it("refunds a paid offline order only once staff paid the student back", async () => {
    const orderId = await offlineOrder();
    await offline.confirmOfflinePayment(orderId);

    await expect(offline.refundOrder(orderId, { isRefundedByHand: false })).rejects.toThrow(RefundByHandRequiredError);
    await offline.refundOrder(orderId, { isRefundedByHand: true });

    expect(store.orders[0]).toMatchObject({ status: "refunded", refund: { isRefundedByHand: true } });
  });
});

describe("plans", () => {
  /**
   * Builds the school's selling use cases on a plan, with the payment QR uploaded.
   *
   * @param plan The school's plan.
   * @returns The service.
   */
  function onPlan(plan: "free" | "pro") {
    store.courses.set("c6", { id: "c6", slug: "club", title: "Design Club", isPublished: true, price: { id: "p6", amount: 1500, currency: "USD", billing: { kind: "recurring", interval: "month" } } });
    store.hasQr = true;
    return commerceWith([stripe, khqr], { plan });
  }

  it("records the platform's fee at the school's plan on each order", async () => {
    await onPlan("pro").checkout(BUYER, { courseSlug: "intro", method: "stripe", locale: "en" }, urls);
    await onPlan("free").checkout(BUYER, { courseSlug: "riel", method: "bakong_khqr", locale: "en" }, urls);

    expect(store.orders.map(({ platformFee }) => platformFee)).toEqual([245, 2000]);
  });

  it("offers the school's payment QR only on a plan that includes it", async () => {
    expect((await onPlan("free").getOffer("club")).methods).toEqual(["bakong_khqr"]);
    expect((await onPlan("pro").getOffer("club")).methods).toEqual(["offline_qr", "bakong_khqr"]);
  });
});

