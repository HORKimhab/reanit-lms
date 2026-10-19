// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { getOrderStatus, startCheckout, type CheckoutState } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

const ROUTE = "POST /schools/by-subdomain/angkor/checkout";
const ORDER_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a05";
const IDLE: CheckoutState = { status: "idle" };

/**
 * Submits the checkout form for the test course.
 *
 * @param method The chosen method.
 * @returns What the form shows next.
 */
function pay(method: string | null) {
  const formData = new FormData();
  if (method !== null) formData.set("method", method);
  return startCheckout("angkor", "brand", IDLE, formData);
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

describe("startCheckout", () => {
  it("starts an order for the course with the chosen method", async () => {
    onApi(ROUTE, started({ kind: "form", action: "https://payway.test/purchase", fields: { tran_id: "t1" } }));

    expect(await pay("aba_payway")).toEqual({ status: "form", action: "https://payway.test/purchase", fields: { tran_id: "t1" } });
    expect(await requestTo(ROUTE)?.json()).toEqual({ courseSlug: "brand", method: "aba_payway" });
  });

  it("sends a card payment to Stripe's page", async () => {
    onApi(ROUTE, started({ kind: "redirect", url: "https://checkout.stripe.test/c/1" }));

    await expect(pay("stripe")).rejects.toEqual(new RedirectError("https://checkout.stripe.test/c/1"));
  });

  it("returns the KHQR code and the order to wait on", async () => {
    onApi(ROUTE, started({ kind: "qr", qr: "00020101021229", expiresAt: "2026-10-19T01:15:00.000Z" }));

    expect(await pay("bakong_khqr")).toEqual({ status: "qr", qr: "00020101021229", expiresAt: "2026-10-19T01:15:00.000Z", orderId: ORDER_ID });
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
