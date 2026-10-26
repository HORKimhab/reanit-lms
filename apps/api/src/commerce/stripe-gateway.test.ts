import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import { createStripeGateway } from "./stripe-gateway";

const REQUEST = {
  orderId: "order-1",
  amount: 4900,
  currency: "USD" as const,
  description: "Brand Design Basics",
  customerEmail: "dara@example.com",
  successUrl: "https://app.test/s/angkor/orders/order-1",
  cancelUrl: "https://app.test/s/angkor/courses/brand",
};

/**
 * Creates a Stripe client whose session creation is stubbed.
 *
 * @param session What Stripe answers.
 * @param session.id The session's id.
 * @param session.url Its hosted page, or null.
 * @returns The client and the stub.
 */
function stubbedStripe(session: { id: string; url: string | null }) {
  const stripe = new Stripe("sk_test_reanit");
  const create = vi.spyOn(stripe.checkout.sessions, "create").mockResolvedValue(session as never);
  return { stripe, create };
}

describe("createStripeGateway", () => {
  it("takes USD and KHR", () => {
    const gateway = createStripeGateway(new Stripe("sk_test_reanit"));

    expect(gateway.supports("USD")).toBe(true);
    expect(gateway.supports("KHR")).toBe(true);
  });

  it("opens a Checkout Session for the order and redirects to it", async () => {
    const { stripe, create } = stubbedStripe({ id: "cs_1", url: "https://checkout.stripe.test/cs_1" });

    const start = await createStripeGateway(stripe).startPayment(REQUEST);

    expect(start).toEqual({ kind: "redirect", url: "https://checkout.stripe.test/cs_1", providerRef: "cs_1" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: 4900, product_data: { name: "Brand Design Basics" } } }],
        customer_email: "dara@example.com",
        client_reference_id: "order-1",
        success_url: REQUEST.successUrl,
        cancel_url: REQUEST.cancelUrl,
      }),
    );
  });

  it("throws when Stripe returns no URL", async () => {
    const { stripe } = stubbedStripe({ id: "cs_1", url: null });

    await expect(createStripeGateway(stripe).startPayment(REQUEST)).rejects.toThrow("no URL");
  });
});

describe("createStripeGateway refund", () => {
  /**
   * Creates a Stripe client whose session lookup and refund creation are stubbed.
   *
   * @param paymentIntent The session's payment, or null.
   * @returns The client and the refund stub.
   */
  function refundingStripe(paymentIntent: string | null) {
    const stripe = new Stripe("sk_test_reanit");
    vi.spyOn(stripe.checkout.sessions, "retrieve").mockResolvedValue({ id: "cs_1", payment_intent: paymentIntent } as never);
    const create = vi.spyOn(stripe.refunds, "create").mockResolvedValue({ id: "re_1" } as never);
    return { stripe, create };
  }

  it("refunds the session's payment in full, keyed by the session so a retry refunds once", async () => {
    const { stripe, create } = refundingStripe("pi_1");

    await createStripeGateway(stripe).refund?.("cs_1");

    expect(create).toHaveBeenCalledWith({ payment_intent: "pi_1" }, { idempotencyKey: "refund-cs_1" });
  });

  it("counts a payment Stripe already refunded as refunded", async () => {
    const { stripe, create } = refundingStripe("pi_1");
    create.mockRejectedValue(new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", code: "charge_already_refunded", message: "Charge already refunded" }));

    await expect(createStripeGateway(stripe).refund?.("cs_1")).resolves.toBeUndefined();
  });

  it("throws when Stripe refuses the refund for another reason", async () => {
    const { stripe, create } = refundingStripe("pi_1");
    create.mockRejectedValue(new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", code: "charge_disputed", message: "Charge disputed" }));

    await expect(createStripeGateway(stripe).refund?.("cs_1")).rejects.toThrow("Charge disputed");
  });

  it("throws for a session with no payment", async () => {
    const { stripe } = refundingStripe(null);

    await expect(createStripeGateway(stripe).refund?.("cs_1")).rejects.toThrow("Stripe session cs_1 has no payment to refund");
  });
});
