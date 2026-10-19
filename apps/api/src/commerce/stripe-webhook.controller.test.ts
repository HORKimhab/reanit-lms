import { UnknownPaymentError } from "@reanit/core/commerce";
import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { TEST_ENV, useTestApp } from "../test/app";

const stripe = new Stripe("sk_test_reanit");

/**
 * Builds a webhook request as Stripe sends it, signed with the test secret.
 *
 * @param type The event type.
 * @param session The Checkout Session fields.
 * @param secret The secret to sign with.
 * @returns The request for `app.inject`.
 */
function stripeEvent(type: string, session: object, secret = TEST_ENV.STRIPE_WEBHOOK_SECRET ?? "") {
  const payload = JSON.stringify({ id: "evt_1", object: "event", type, data: { object: { object: "checkout.session", ...session } } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { method: "POST" as const, url: "/webhooks/stripe", headers: { "content-type": "application/json", "stripe-signature": signature }, payload };
}

const testApp = useTestApp();

describe("POST /webhooks/stripe", () => {
  it("confirms a paid Checkout Session", async () => {
    const response = await testApp.app.inject(stripeEvent("checkout.session.completed", { id: "cs_1", payment_status: "paid" }));

    expect(response.statusCode).toBe(200);
    expect(testApp.clients.confirmation.confirm).toHaveBeenCalledWith("stripe", "cs_1");
  });

  it("confirms a delayed payment once it succeeds", async () => {
    await testApp.app.inject(stripeEvent("checkout.session.async_payment_succeeded", { id: "cs_2", payment_status: "paid" }));

    expect(testApp.clients.confirmation.confirm).toHaveBeenCalledWith("stripe", "cs_2");
  });

  it.each([
    ["a completed session still waiting for its payment", "checkout.session.completed", "unpaid"],
    ["an unrelated event", "customer.created", "paid"],
  ])("acknowledges %s without enrolling", async (_case, type, payment_status) => {
    const response = await testApp.app.inject(stripeEvent(type, { id: "cs_3", payment_status }));

    expect(response.statusCode).toBe(200);
    expect(testApp.clients.confirmation.confirm).not.toHaveBeenCalled();
  });

  it("refuses a forged signature with 400 so nothing enrolls", async () => {
    const response = await testApp.app.inject(stripeEvent("checkout.session.completed", { id: "cs_1", payment_status: "paid" }, "whsec_wrong"));

    expect(response.statusCode).toBe(400);
    expect(testApp.clients.confirmation.confirm).not.toHaveBeenCalled();
  });

  it("acknowledges a paid session no order knows, so Stripe stops retrying", async () => {
    testApp.clients.confirmation.confirm.mockRejectedValue(new UnknownPaymentError());

    const response = await testApp.app.inject(stripeEvent("checkout.session.completed", { id: "cs_x", payment_status: "paid" }));

    expect(response.statusCode).toBe(200);
  });

  it("answers 500 when confirming fails, so Stripe retries", async () => {
    testApp.clients.confirmation.confirm.mockRejectedValue(new Error("database down"));

    const response = await testApp.app.inject(stripeEvent("checkout.session.completed", { id: "cs_1", payment_status: "paid" }));

    expect(response.statusCode).toBe(500);
  });
});
