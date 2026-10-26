// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { formData as form } from "@/test/form";
import { setTestLocale } from "@/test/intl-server";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { checkCoupon, getOrderStatus, startCheckout, startRenewal, submitOfflinePayment, type CheckoutState } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

const ROUTE = "POST /schools/by-subdomain/angkor/checkout";
const ORDER_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a05";
const IDLE: CheckoutState = { status: "idle" };
const OFFER_ROUTE = "GET /schools/by-subdomain/angkor/courses/brand/offer";

/**
 * Submits the checkout form for the test course.
 *
 * @param method The chosen method.
 * @param couponCode The applied coupon's code, if any.
 * @returns What the form shows next.
 */
function pay(method: string | null, couponCode?: string) {
  const formData = new FormData();
  if (method !== null) formData.set("method", method);
  if (couponCode !== undefined) formData.set("couponCode", couponCode);
  return startCheckout("angkor", "course", "brand", IDLE, formData);
}

/**
 * Builds the API's answer to a started checkout.
 *
 * @param payment The gateway's next step.
 * @returns The response.
 */
function started(payment: Record<string, unknown>) {
  return Response.json({ orderId: ORDER_ID, payment }, { status: 201 });
}

beforeEach(() => {
  signIn();
});

describe("startCheckout with a coupon", () => {
  it("sends the applied coupon's code with the order", async () => {
    onApi(ROUTE, started({ kind: "form", action: "https://payway.test/purchase", fields: { tran_id: "t1" } }));

    await pay("aba_payway", "SAVE20");

    expect(await requestTo(ROUTE)?.json()).toMatchObject({ couponCode: "SAVE20" });
  });

  it("sends no coupon when none was applied", async () => {
    onApi(ROUTE, started({ kind: "form", action: "https://payway.test/purchase", fields: { tran_id: "t1" } }));

    await pay("aba_payway", "");

    expect(await requestTo(ROUTE)?.json()).not.toHaveProperty("couponCode");
  });

  it("says the coupon stopped working when the API refuses it", async () => {
    onApi(ROUTE, problem(400, "urn:reanit:problem:invalid-coupon"));

    expect(await pay("stripe", "SAVE20")).toEqual({ status: "invalidCoupon" });
  });
});

describe("bundles", () => {
  const BUNDLE_ROUTE = "POST /schools/by-subdomain/angkor/bundle-checkout";

  it("starts buying a bundle with the chosen method and coupon", async () => {
    onApi(BUNDLE_ROUTE, started({ kind: "form", action: "https://payway.test/purchase", fields: { tran_id: "t1" } }));
    const formData = new FormData();
    formData.set("method", "aba_payway");
    formData.set("couponCode", "KIT10");

    expect(await startCheckout("angkor", "bundle", "design-kit", IDLE, formData)).toMatchObject({ status: "form" });
    expect(await requestTo(BUNDLE_ROUTE)?.json()).toEqual({ bundleSlug: "design-kit", method: "aba_payway", couponCode: "KIT10", locale: "en" });
  });

  it("sends a signed-out buyer to log in and back to the bundle's checkout", async () => {
    onApi(BUNDLE_ROUTE, problem(401));
    const formData = new FormData();
    formData.set("method", "stripe");

    await expect(startCheckout("angkor", "bundle", "design-kit", IDLE, formData)).rejects.toEqual(
      new RedirectError("/login?next=%2Fs%2Fangkor%2Fbundle-checkout%2Fdesign-kit"),
    );
  });

  it("checks a coupon against the bundle's price", async () => {
    const discount = { code: "KIT10", amountOff: 990, total: 8910 };
    onApi("GET /schools/by-subdomain/angkor/bundles/design-kit/offer", Response.json({ price: { amount: 9900, currency: "USD" }, methods: ["stripe"], discount }));

    expect(await checkCoupon("angkor", "bundle", "design-kit", "kit10")).toEqual({ status: "applied", discount });
  });
});

describe("checkCoupon", () => {
  it("returns what the coupon takes off, asking with the code in upper case", async () => {
    const discount = { code: "SAVE20", amountOff: 980, total: 3920 };
    onApi(OFFER_ROUTE, Response.json({ price: { amount: 4900, currency: "USD" }, methods: ["stripe"], discount }));

    expect(await checkCoupon("angkor", "course", "brand", " save20 ")).toEqual({ status: "applied", discount });
    expect(new URL(requestTo(OFFER_ROUTE)?.url ?? "").searchParams.get("coupon")).toBe("SAVE20");
  });

  it("says a coupon the API refuses cannot be used", async () => {
    onApi(OFFER_ROUTE, problem(400, "urn:reanit:problem:invalid-coupon"));

    expect(await checkCoupon("angkor", "course", "brand", "OLD20")).toEqual({ status: "invalid" });
  });

  it("refuses a malformed code without asking the API", async () => {
    expect(await checkCoupon("angkor", "course", "brand", "no spaces")).toEqual({ status: "invalid" });
    expect(requestTo(OFFER_ROUTE)).toBeUndefined();
  });
});

describe("startCheckout", () => {
  it("starts an order for the course with the chosen method", async () => {
    onApi(ROUTE, started({ kind: "form", action: "https://payway.test/purchase", fields: { tran_id: "t1" } }));

    expect(await pay("aba_payway")).toEqual({ status: "form", action: "https://payway.test/purchase", fields: { tran_id: "t1" } });
    expect(await requestTo(ROUTE)?.json()).toEqual({ courseSlug: "brand", method: "aba_payway", locale: "en" });
  });

  it("sends the page's language, so a Khmer buyer gets Khmer emails", async () => {
    setTestLocale("km");
    onApi(ROUTE, started({ kind: "form", action: "https://payway.test/purchase", fields: { tran_id: "t1" } }));

    await pay("aba_payway");

    expect(await requestTo(ROUTE)?.json()).toMatchObject({ locale: "km" });
  });

  it("sends a card payment to Stripe's page", async () => {
    onApi(ROUTE, started({ kind: "redirect", url: "https://checkout.stripe.test/c/1" }));

    await expect(pay("stripe")).rejects.toEqual(new RedirectError("https://checkout.stripe.test/c/1"));
  });

  it("returns the KHQR code and the order to wait on", async () => {
    onApi(ROUTE, started({ kind: "qr", qr: "00020101021229", expiresAt: "2026-10-19T01:15:00.000Z" }));

    expect(await pay("bakong_khqr")).toEqual({ status: "qr", qr: "00020101021229", expiresAt: "2026-10-19T01:15:00.000Z", orderId: ORDER_ID });
  });

  it("returns the school's payment QR image and the order for an offline payment", async () => {
    onApi(ROUTE, started({ kind: "offline", qrImageUrl: "https://storage.test/qr.png" }));

    expect(await pay("offline_qr")).toEqual({ status: "offline", qrImageUrl: "https://storage.test/qr.png", orderId: ORDER_ID });
  });

  it.each([null, "cash"])("refuses method %s without calling the API", async (method) => {
    expect(await pay(method)).toEqual({ status: "unavailable" });
    expect(requestTo(ROUTE)).toBeUndefined();
  });

  it("tells a student who already has the course", async () => {
    onApi(ROUTE, problem(409, "urn:reanit:problem:already-enrolled"));

    expect(await pay("stripe")).toEqual({ status: "enrolled" });
  });

  it.each([400, 409])("reports the method unavailable when the API answers %i", async (status) => {
    onApi(ROUTE, problem(status));

    expect(await pay("stripe")).toEqual({ status: "unavailable" });
  });

  it("sends a signed-out visitor to log in and back to checkout", async () => {
    onApi(ROUTE, problem(401));

    await expect(pay("stripe")).rejects.toEqual(new RedirectError("/login?next=%2Fs%2Fangkor%2Fcheckout%2Fbrand"));
  });

  it("throws when the API fails", async () => {
    onApi(ROUTE, problem(500));

    await expect(pay("stripe")).rejects.toThrow("API answered 500");
  });
});

describe("getOrderStatus", () => {
  const ORDER_ROUTE = `GET /schools/by-subdomain/angkor/orders/${ORDER_ID}`;

  it("reads the order's status", async () => {
    onApi(ORDER_ROUTE, Response.json({ order: { id: ORDER_ID, status: "paid", courseId: ORDER_ID, amount: 4900, currency: "USD", method: "bakong_khqr" } }));

    expect(await getOrderStatus("angkor", ORDER_ID)).toBe("paid");
  });

  it("404s on someone else's order", async () => {
    onApi(ORDER_ROUTE, problem(404));

    await expect(getOrderStatus("angkor", ORDER_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("startRenewal", () => {
  const SUBSCRIPTION_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a30";
  const RENEW_ROUTE = `POST /schools/by-subdomain/angkor/subscriptions/${SUBSCRIPTION_ID}/renew`;

  beforeEach(() => {
    signIn();
  });

  it("pays the next period in the page's language and shows the next step", async () => {
    setTestLocale("km");
    onApi(RENEW_ROUTE, started({ kind: "offline", qrImageUrl: "https://storage.test/qr.png" }));

    expect(await startRenewal("angkor", SUBSCRIPTION_ID, IDLE, form({ method: "offline_qr" }))).toEqual({ status: "offline", qrImageUrl: "https://storage.test/qr.png", orderId: ORDER_ID });
    expect(await requestTo(RENEW_ROUTE)?.json()).toEqual({ method: "offline_qr", locale: "km" });
  });

  it("refuses a method that cannot renew, and a subscription that cannot take a payment", async () => {
    expect(await startRenewal("angkor", SUBSCRIPTION_ID, IDLE, form({ method: "cash" }))).toEqual({ status: "unavailable" });
    onApi(RENEW_ROUTE, problem(409, "urn:reanit:problem:subscription-not-renewable"));

    expect(await startRenewal("angkor", SUBSCRIPTION_ID, IDLE, form({ method: "aba_payway" }))).toEqual({ status: "unavailable" });
  });
});

describe("submitOfflinePayment", () => {
  const PAID_ROUTE = `POST /schools/by-subdomain/angkor/orders/${ORDER_ID}/offline-payment`;

  beforeEach(() => {
    signIn();
  });

  it("sends the reference, then opens the order's page", async () => {
    onApi(PAID_ROUTE, new Response(null, { status: 204 }));

    await expect(submitOfflinePayment("angkor", ORDER_ID, { status: "idle" }, form({ reference: " ABA-123 " }))).rejects.toThrow(new RedirectError(`/s/angkor/orders/${ORDER_ID}`));
    expect(await requestTo(PAID_ROUTE)?.json()).toEqual({ reference: "ABA-123" });
  });

  it("asks for a reference without calling the API", async () => {
    expect(await submitOfflinePayment("angkor", ORDER_ID, { status: "idle" }, form({ reference: " " }))).toEqual({ status: "invalid" });
    expect(requestTo(PAID_ROUTE)).toBeUndefined();
  });

  it("says when the order no longer waits for a payment", async () => {
    onApi(PAID_ROUTE, problem(409, "urn:reanit:problem:offline-payment-closed"));

    expect(await submitOfflinePayment("angkor", ORDER_ID, { status: "idle" }, form({ reference: "ABA-123" }))).toEqual({ status: "closed" });
  });
});

