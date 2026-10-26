import { beforeEach, describe, expect, it } from "vitest";

import { createPaymentConfirmation, UnknownPaymentError } from "../commerce";
import { FakeClock } from "../test/auth-fakes";
import { AskableFakeGateway, FakeCommerceStore, FakeConfirmationStore, FakeGateway } from "../test/commerce-fakes";
import { FakePlanBillingStore, FakePlanConfirmationStore } from "../test/plan-fakes";
import { PlanPaymentMethodUnavailableError, PlanPaymentNotFoundError } from "./errors";
import { createPlanBilling, planCheckoutSchema, type PlanBilling } from "./plan-billing";

const NOW = new Date("2026-10-27T12:00:00Z");
const OWNER_EMAIL = "sokha@example.com";

/**
 * Builds the return URLs for a plan payment.
 *
 * @param paymentId The payment.
 * @returns Success and cancel URLs naming it.
 */
function urls(paymentId: string) {
  return { successUrl: `https://app.test/dashboard/settings?payment=${paymentId}`, cancelUrl: "https://app.test/dashboard/settings" };
}

let store: FakePlanBillingStore;
let payway: AskableFakeGateway;
let clock: FakeClock;
let billing: PlanBilling;

beforeEach(() => {
  store = new FakePlanBillingStore();
  payway = new AskableFakeGateway("aba_payway", ["USD", "KHR"]);
  clock = new FakeClock(NOW);
  const confirmation = createPaymentConfirmation({ store: new FakeConfirmationStore(new FakeCommerceStore()), plans: new FakePlanConfirmationStore(store), clock });
  billing = createPlanBilling({ store, gateways: [new FakeGateway("stripe", ["USD"]), payway], confirmPlanPayment: confirmation.confirm, clock });
});

describe("getPlan", () => {
  it("is Free with its limits for a school that never paid, offering the gateways that bill period by period", async () => {
    expect(await billing.getPlan()).toMatchObject({ plan: "free", paid: null, terms: { feeBasisPoints: 1000, limits: { publishedCourses: 3 } }, methods: ["aba_payway"] });
  });

  it("shows a paid plan, and Free once it ran out past its grace week", async () => {
    store.stored = { plan: "pro", interval: "month", periodEnd: new Date("2026-11-01T00:00:00Z") };
    expect(await billing.getPlan()).toMatchObject({ plan: "pro", paid: { plan: "pro", interval: "month" } });

    clock.advance(30 * 24 * 60 * 60 * 1000);

    expect(await billing.getPlan()).toMatchObject({ plan: "free", paid: { plan: "pro" } });
  });
});

describe("checkout", () => {
  it("charges the plan's price for the period through the gateway", async () => {
    const { paymentId, payment } = await billing.checkout(OWNER_EMAIL, planCheckoutSchema.parse({ plan: "business", interval: "year", method: "aba_payway" }), urls);

    expect(payment).toMatchObject({ kind: "redirect", providerRef: `ref-${paymentId}` });
    expect(store.payments[0]).toMatchObject({ plan: "business", interval: "year", amount: 99_000, status: "pending", providerRef: `ref-${paymentId}` });
    expect(payway.requests[0]).toMatchObject({ amount: 99_000, currency: "USD", customerEmail: OWNER_EMAIL });
  });

  it.each(["stripe", "bakong_khqr", "offline_qr"] as const)("refuses %s, which cannot take a plan payment here", async (method) => {
    await expect(billing.checkout(OWNER_EMAIL, { plan: "pro", interval: "month", method, locale: "en" }, urls)).rejects.toThrow(PlanPaymentMethodUnavailableError);
    expect(store.payments).toEqual([]);
  });

  it.each([{ plan: "free", interval: "month", method: "aba_payway" }, { plan: "pro", interval: "week", method: "aba_payway" }])("refuses the input %j", (input) => {
    expect(planCheckoutSchema.safeParse(input).success).toBe(false);
  });
});

describe("getPlanPayment", () => {
  it("moves the plan on once the gateway says the payment arrived", async () => {
    const { paymentId } = await billing.checkout(OWNER_EMAIL, { plan: "pro", interval: "month", method: "aba_payway", locale: "en" }, urls);
    expect(await billing.getPlanPayment(paymentId)).toBe("pending");
    payway.checkResult = "paid";

    expect(await billing.getPlanPayment(paymentId)).toBe("paid");

    expect(store.stored).toEqual({ plan: "pro", interval: "month", periodEnd: new Date("2026-11-27T12:00:00Z") });
  });

  it("extends the plan from the end of its paid period when the same plan is paid again", async () => {
    store.stored = { plan: "pro", interval: "month", periodEnd: new Date("2026-11-10T00:00:00Z") };
    const { paymentId } = await billing.checkout(OWNER_EMAIL, { plan: "pro", interval: "month", method: "aba_payway", locale: "en" }, urls);
    payway.checkResult = "paid";

    await billing.getPlanPayment(paymentId);

    expect(store.stored.periodEnd).toEqual(new Date("2026-12-10T00:00:00Z"));
  });

  it("fails a payment the gateway says will not complete", async () => {
    const { paymentId } = await billing.checkout(OWNER_EMAIL, { plan: "pro", interval: "month", method: "aba_payway", locale: "en" }, urls);
    payway.checkResult = "failed";

    expect(await billing.getPlanPayment(paymentId)).toBe("failed");
    expect(store.stored.plan).toBe("free");
  });

  it("throws PlanPaymentNotFoundError for a payment the school does not have", async () => {
    await expect(billing.getPlanPayment("plan-payment-404")).rejects.toThrow(PlanPaymentNotFoundError);
  });
});

describe("payment confirmation", () => {
  it("confirms a plan payment a gateway's webhook names, and refuses an unknown reference", async () => {
    const confirmation = createPaymentConfirmation({ store: new FakeConfirmationStore(new FakeCommerceStore()), plans: new FakePlanConfirmationStore(store), clock });
    const { paymentId } = await billing.checkout(OWNER_EMAIL, { plan: "business", interval: "month", method: "aba_payway", locale: "en" }, urls);

    expect(await confirmation.confirm("aba_payway", `ref-${paymentId}`)).toEqual({ orderId: paymentId, isNewlyPaid: true });
    expect(store.stored.plan).toBe("business");
    await expect(confirmation.confirm("aba_payway", "ref-unknown")).rejects.toThrow(UnknownPaymentError);
  });
});
