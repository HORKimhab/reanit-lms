import { beforeEach, describe, expect, it } from "vitest";

import { createPaymentConfirmation, UnknownPaymentError, type PaymentConfirmation } from "../commerce";
import { FakeClock } from "../test/auth-fakes";
import { AskableFakeGateway, FakeCommerceStore, FakeConfirmationStore, FakeGateway } from "../test/commerce-fakes";
import { FakePlanBillingStore, FakePlanConfirmationStore } from "../test/plan-fakes";
import { PlanPaymentClosedError, PlanPaymentMethodUnavailableError, PlanPaymentNotFoundError } from "./errors";
import { createPlanBilling, planCheckoutSchema, type PlanBilling } from "./plan-billing";

const NOW = new Date("2026-10-27T12:00:00Z");
const OWNER_EMAIL = "sokha@example.com";
const PLATFORM_QR_URL = "https://cdn.reanit.test/platform-qr.png";

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
let confirmation: PaymentConfirmation;
let billing: PlanBilling;

/**
 * Builds the school's plan billing over the shared store, gateways and clock.
 *
 * @param platformQrUrl The platform's payment QR, or null when plans cannot be paid by QR transfer.
 * @returns The plan billing.
 */
function billingWith(platformQrUrl: string | null) {
  return createPlanBilling({ store, gateways: [new FakeGateway("stripe", ["USD"]), payway], platformQrUrl, confirmPlanPayment: confirmation.confirm, clock });
}

beforeEach(() => {
  store = new FakePlanBillingStore();
  payway = new AskableFakeGateway("aba_payway", ["USD", "KHR"]);
  clock = new FakeClock(NOW);
  confirmation = createPaymentConfirmation({ store: new FakeConfirmationStore(new FakeCommerceStore()), plans: new FakePlanConfirmationStore(store), clock });
  billing = billingWith(null);
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

  it.each(["stripe", "bakong_khqr", "offline_qr"] as const)("refuses %s, which cannot take a plan payment here without a platform QR", async (method) => {
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

describe("paying by the platform's QR", () => {
  beforeEach(() => {
    billing = billingWith(PLATFORM_QR_URL);
  });

  /**
   * Starts a Pro month paid to the platform's QR.
   *
   * @returns The payment's id.
   */
  async function startQrPayment() {
    const { paymentId, payment } = await billing.checkout(OWNER_EMAIL, { plan: "pro", interval: "month", method: "offline_qr", locale: "en" }, urls);
    expect(payment).toEqual({ kind: "offline", qrImageUrl: PLATFORM_QR_URL });
    return paymentId;
  }

  it("offers the platform's QR before the gateways", async () => {
    expect((await billing.getPlan()).methods).toEqual(["offline_qr", "aba_payway"]);
  });

  it("still refuses a method that cannot take a plan payment", async () => {
    await expect(billing.checkout(OWNER_EMAIL, { plan: "pro", interval: "month", method: "stripe", locale: "en" }, urls)).rejects.toThrow(PlanPaymentMethodUnavailableError);
  });

  it("shows the QR without asking a gateway, and keeps the payment pending once the creator gives their reference", async () => {
    const paymentId = await startQrPayment();

    await billing.submitOfflinePayment(paymentId, { reference: "ABA-123" });

    expect(store.payments[0]).toMatchObject({ method: "offline_qr", amount: 2_900, status: "pending", providerRef: null, reference: "ABA-123" });
    expect(payway.requests).toEqual([]);
    expect(await billing.getPlanPayment(paymentId)).toBe("pending");
  });

  it("refuses a reference for a gateway payment or one already settled, and for an unknown payment", async () => {
    const { paymentId: gatewayPaymentId } = await billing.checkout(OWNER_EMAIL, { plan: "pro", interval: "month", method: "aba_payway", locale: "en" }, urls);
    const qrPaymentId = await startQrPayment();
    await store.failPlanPayment(qrPaymentId);

    await expect(billing.submitOfflinePayment(gatewayPaymentId, { reference: "X" })).rejects.toThrow(PlanPaymentClosedError);
    await expect(billing.submitOfflinePayment(qrPaymentId, { reference: "X" })).rejects.toThrow(PlanPaymentClosedError);
    await expect(billing.submitOfflinePayment("plan-payment-404", { reference: "X" })).rejects.toThrow(PlanPaymentNotFoundError);
  });

  it("moves the plan on once when an admin confirms it, and never confirms a gateway payment by id", async () => {
    const paymentId = await startQrPayment();
    const { paymentId: gatewayPaymentId } = await billing.checkout(OWNER_EMAIL, { plan: "business", interval: "year", method: "aba_payway", locale: "en" }, urls);

    expect(await confirmation.confirmOfflinePlan(paymentId)).toEqual({ paymentId, isNewlyPaid: true });
    expect(await confirmation.confirmOfflinePlan(paymentId)).toEqual({ paymentId, isNewlyPaid: false });

    expect(store.stored).toEqual({ plan: "pro", interval: "month", periodEnd: new Date("2026-11-27T12:00:00Z") });
    await expect(confirmation.confirmOfflinePlan(gatewayPaymentId)).rejects.toThrow(UnknownPaymentError);
  });
});
