import {
  AlreadyEnrolledError,
  CourseNotForSaleError,
  OrderNotFoundError,
  PaymentMethodUnavailableError,
} from "@reanit/core/commerce";
import { describe, expect, it } from "vitest";

import { type FakeClients, useTestApp } from "../test/app";
import { signInAs, TEST_SCHOOL, TEST_USER } from "../test/session";

const BASE_URL = `/schools/by-subdomain/${TEST_SCHOOL.subdomain}`;
const ORDER_ID = "8d7c6b5a-4f3e-4d2c-9b1a-0f9e8d7c6b5a";

/**
 * Makes every subdomain resolve to `TEST_SCHOOL`.
 *
 * @param clients Fakes from `createFakeClients`.
 */
function resolveTestSchool(clients: FakeClients) {
  clients.schools.getSchoolBySubdomain.mockResolvedValue(TEST_SCHOOL);
}

const testApp = useTestApp(resolveTestSchool);

describe("GET .../courses/:slug/offer", () => {
  it("tells anyone the price and the methods for its currency", async () => {
    testApp.clients.commerce.getOffer.mockResolvedValue({ price: { id: "p", amount: 4900, currency: "USD" }, methods: ["stripe", "bakong_khqr"] });

    const response = await testApp.app.inject({ method: "GET", url: `${BASE_URL}/courses/intro/offer` });

    expect(response.json()).toEqual({ price: { amount: 4900, currency: "USD" }, methods: ["stripe", "bakong_khqr"] });
    expect(testApp.clients.commerceFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
  });

  it("says a course without a price is not for sale", async () => {
    testApp.clients.commerce.getOffer.mockResolvedValue({ price: null, methods: [] });

    const response = await testApp.app.inject({ method: "GET", url: `${BASE_URL}/courses/free/offer` });

    expect(response.json()).toEqual({ price: null, methods: [] });
  });
});

describe("POST .../checkout", () => {
  const BODY = { courseSlug: "intro", method: "stripe" };

  it("starts the payment for the signed-in buyer and returns where to go", async () => {
    const headers = signInAs(testApp.clients);
    testApp.clients.commerce.checkout.mockResolvedValue({
      orderId: ORDER_ID,
      payment: { kind: "redirect", url: "https://checkout.stripe.test/s", providerRef: "cs_1" },
    });

    const response = await testApp.app.inject({ method: "POST", url: `${BASE_URL}/checkout`, headers, payload: BODY });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ orderId: ORDER_ID, payment: { kind: "redirect", url: "https://checkout.stripe.test/s" } });
    const [buyer, input, urls] = testApp.clients.commerce.checkout.mock.calls[0] ?? [];
    expect(buyer).toEqual({ userId: TEST_USER.id, email: TEST_USER.email });
    expect(input).toEqual({ ...BODY, locale: "en" });
    expect(urls(ORDER_ID)).toEqual({
      successUrl: `http://localhost:3000/s/${TEST_SCHOOL.subdomain}/orders/${ORDER_ID}`,
      cancelUrl: `http://localhost:3000/s/${TEST_SCHOOL.subdomain}/courses/intro`,
    });
  });

  it("passes the buyer's language on, for their emails", async () => {
    const headers = signInAs(testApp.clients);
    testApp.clients.commerce.checkout.mockResolvedValue({ orderId: ORDER_ID, payment: { kind: "redirect", url: "https://pay.test", providerRef: "cs_1" } });

    await testApp.app.inject({ method: "POST", url: `${BASE_URL}/checkout`, headers, payload: { ...BODY, locale: "km" } });

    expect(testApp.clients.commerce.checkout.mock.calls[0]?.[1]).toMatchObject({ locale: "km" });
  });

  it("returns a KHQR code with its expiry, never the gateway reference", async () => {
    const headers = signInAs(testApp.clients);
    const expiresAt = new Date("2026-10-19T01:00:00Z");
    testApp.clients.commerce.checkout.mockResolvedValue({ orderId: ORDER_ID, payment: { kind: "qr", qr: "000201...", providerRef: "md5", expiresAt } });

    const response = await testApp.app.inject({ method: "POST", url: `${BASE_URL}/checkout`, headers, payload: { ...BODY, method: "bakong_khqr" } });

    expect(response.json().payment).toEqual({ kind: "qr", qr: "000201...", expiresAt: expiresAt.toISOString() });
  });

  it.each([
    [new CourseNotForSaleError(), 409, "course-not-for-sale"],
    [new AlreadyEnrolledError(), 409, "already-enrolled"],
    [new PaymentMethodUnavailableError(), 400, "payment-method-unavailable"],
  ])("answers %s with %i", async (error, status, code) => {
    const headers = signInAs(testApp.clients);
    testApp.clients.commerce.checkout.mockRejectedValue(error);

    const response = await testApp.app.inject({ method: "POST", url: `${BASE_URL}/checkout`, headers, payload: BODY });

    expect(response.statusCode).toBe(status);
    expect(response.json().type).toBe(`urn:reanit:problem:${code}`);
  });

  it("answers 400 for an unknown method and 401 when signed out", async () => {
    const headers = signInAs(testApp.clients);
    expect((await testApp.app.inject({ method: "POST", url: `${BASE_URL}/checkout`, headers, payload: { ...BODY, method: "paypal" } })).statusCode).toBe(400);
    expect((await testApp.app.inject({ method: "POST", url: `${BASE_URL}/checkout`, payload: BODY })).statusCode).toBe(401);
    expect(testApp.clients.commerce.checkout).not.toHaveBeenCalled();
  });
});

describe("GET .../orders/:orderId", () => {
  it("returns the buyer's order", async () => {
    const headers = signInAs(testApp.clients);
    const order = { id: ORDER_ID, status: "paid", courseId: ORDER_ID, amount: 4900, currency: "USD", method: "stripe" };
    testApp.clients.commerce.getOrder.mockResolvedValue(order);

    const response = await testApp.app.inject({ method: "GET", url: `${BASE_URL}/orders/${ORDER_ID}`, headers });

    expect(response.json()).toEqual({ order });
    expect(testApp.clients.commerce.getOrder).toHaveBeenCalledWith(ORDER_ID, TEST_USER.id);
  });

  it("answers 404 for another buyer's order", async () => {
    const headers = signInAs(testApp.clients);
    testApp.clients.commerce.getOrder.mockRejectedValue(new OrderNotFoundError());

    expect((await testApp.app.inject({ method: "GET", url: `${BASE_URL}/orders/${ORDER_ID}`, headers })).statusCode).toBe(404);
  });
});
