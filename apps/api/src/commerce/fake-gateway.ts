import type { PaymentGateway } from "@reanit/core/commerce";

/** Prefix of the fake's references, so a fake order is easy to tell apart in the database. */
const REFERENCE_PREFIX = "fake_";

/**
 * A card gateway for end-to-end tests (`FAKE_PAYMENTS`): it sends the student straight back to the
 * order page, and reports the payment paid when the order is read. The order is then confirmed and
 * the student enrolled the same way a Bakong or PayWay status check does it; refunds go through at once.
 *
 * @returns The gateway, standing in for Stripe.
 */
export function createFakeGateway(): PaymentGateway {
  return {
    method: "stripe",

    /**
     * Takes every currency.
     *
     * @returns Always true.
     */
    supports() {
      return true;
    },

    /**
     * Skips the payment page: the student lands on the order's status page.
     *
     * @param request The order to charge.
     * @returns A redirect to the success URL, referencing the order.
     */
    async startPayment(request) {
      return { kind: "redirect", url: request.successUrl, providerRef: REFERENCE_PREFIX + request.orderId };
    },

    /**
     * Reports every payment as arrived.
     *
     * @returns Always "paid".
     */
    async checkPayment() {
      return "paid";
    },

    /** Refunds nothing: no money ever moved. */
    async refund() {},
  };
}
