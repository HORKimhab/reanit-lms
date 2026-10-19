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
