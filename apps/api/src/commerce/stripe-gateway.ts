import type { Currency, PaymentGateway, PaymentRequest } from "@reanit/core/commerce";
import Stripe from "stripe";

/** Currencies the Stripe account charges in; both use two-decimal minor units, as Stripe expects. */
const STRIPE_CURRENCIES: ReadonlySet<Currency> = new Set(["USD", "KHR"]);

/** Stripe's error code for refunding a payment it already refunded in full. */
const ALREADY_REFUNDED = "charge_already_refunded";

/** Events that mean a Checkout Session's payment has arrived. */
const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

/**
 * Stripe as a `PaymentGateway`: a hosted Checkout Session per order; the session id is the reference.
 *
 * @param stripe Stripe client for the platform account.
 * @returns The gateway.
 */
export function createStripeGateway(stripe: Stripe): PaymentGateway {
  return {
    method: "stripe",

    /**
     * Tells whether Stripe charges a currency here.
     *
     * @param currency The course's currency.
     * @returns True for USD and KHR.
     */
    supports(currency) {
      return STRIPE_CURRENCIES.has(currency);
    },

    /**
     * Creates a Checkout Session for the order.
     *
     * @param request The order to charge.
     * @returns A redirect to Stripe's hosted page, with the session id as the reference.
     * @throws {Error} When Stripe refuses the session or returns no URL.
     */
    async startPayment(request: PaymentRequest) {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: request.currency.toLowerCase(),
              unit_amount: request.amount,
              product_data: { name: request.description },
            },
          },
        ],
        customer_email: request.customerEmail,
        client_reference_id: request.orderId,
        metadata: { orderId: request.orderId },
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
      });
      if (!session.url) throw new Error(`Stripe returned no URL for session ${session.id}`);
      return { kind: "redirect", url: session.url, providerRef: session.id };
    },

    /**
     * Refunds a Checkout Session's payment in full. Repeating it refunds once: the idempotency key
     * names the session, and a payment Stripe already refunded counts as done.
     *
     * @param sessionId The Checkout Session's id.
     * @throws {Error} When the session has no payment, or Stripe refuses the refund.
     */
    async refund(sessionId: string) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (!paymentIntent) throw new Error(`Stripe session ${sessionId} has no payment to refund`);
      try {
        await stripe.refunds.create({ payment_intent: paymentIntent }, { idempotencyKey: `refund-${sessionId}` });
      } catch (error) {
        if (!(error instanceof Stripe.errors.StripeInvalidRequestError && error.code === ALREADY_REFUNDED)) throw error;
      }
    },
  };
}

/**
 * Verifies a Stripe webhook and picks out a paid Checkout Session.
 *
 * @param stripe Stripe client.
 * @param rawBody The request body exactly as received; parsing it first breaks the signature.
 * @param signature The `stripe-signature` header.
 * @param secret The endpoint's signing secret.
 * @returns The paid session's id, or null for any other event (or an unpaid completion).
 * @throws {Stripe.errors.StripeSignatureVerificationError} When the signature does not match.
 */
export function paidSessionOf(stripe: Stripe, rawBody: Buffer, signature: string, secret: string): string | null {
  const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  if (!PAID_EVENTS.has(event.type)) return null;
  const session = event.data.object as { id: string; payment_status?: string };
  return session.payment_status === "paid" ? session.id : null;
}
