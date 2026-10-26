import { PlanPaymentMethodUnavailableError, PlanPaymentNotFoundError, PLAN_TERMS } from "@reanit/core/schools";
import { describe, expect, it } from "vitest";

import { setStaffRole, TEST_SCHOOL, TEST_USER, useStaffApp } from "../test/session";

const staff = useStaffApp();
const PAYMENT_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a70";

describe("GET /plans", () => {
  it("lists every plan's prices, fee and limits to anyone", async () => {
    const response = await staff.app.inject({ method: "GET", url: "/plans" });

    expect(response.json().plans.map(({ plan, prices, feeBasisPoints }: { plan: string; prices: unknown; feeBasisPoints: number }) => [plan, prices, feeBasisPoints])).toEqual([
      ["free", null, 1000],
      ["pro", { month: 2900, year: 29_000 }, 500],
      ["business", { month: 9900, year: 99_000 }, 200],
    ]);
  });
});

describe("GET /schools/current/plan", () => {
  it("shows an admin the school's plan and what was last paid for", async () => {
    setStaffRole(staff.clients, "admin");
    staff.clients.billing.getPlan.mockResolvedValue({
      plan: "pro",
      terms: PLAN_TERMS.pro,
      paid: { plan: "pro", interval: "month", periodEnd: new Date("2026-11-27T12:00:00Z") },
      methods: ["aba_payway"],
    });

    const response = await staff.app.inject({ method: "GET", url: "/schools/current/plan", headers: staff.headers });

    expect(response.json()).toMatchObject({ plan: "pro", paid: { plan: "pro", interval: "month", periodEnd: "2026-11-27T12:00:00.000Z" }, methods: ["aba_payway"] });
    expect(staff.clients.billingFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
  });

  it("refuses an instructor", async () => {
    const response = await staff.app.inject({ method: "GET", url: "/schools/current/plan", headers: staff.headers });

    expect(response.statusCode).toBe(403);
  });
});

describe("POST /schools/current/plan/checkout", () => {
  it("lets the owner pay for a plan, coming back to the settings", async () => {
    setStaffRole(staff.clients, "owner");
    staff.clients.billing.checkout.mockResolvedValue({ paymentId: PAYMENT_ID, payment: { kind: "redirect", url: "https://payway.test/pay", providerRef: "tran" } });

    const response = await staff.app.inject({ method: "POST", url: "/schools/current/plan/checkout", headers: staff.headers, payload: { plan: "pro", interval: "year", method: "aba_payway" } });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ paymentId: PAYMENT_ID, payment: { kind: "redirect", url: "https://payway.test/pay" } });
    const [email, input, urls] = staff.clients.billing.checkout.mock.calls[0] ?? [];
    expect([email, input]).toEqual([TEST_USER.email, { plan: "pro", interval: "year", method: "aba_payway", locale: "en" }]);
    expect(urls(PAYMENT_ID)).toEqual({ successUrl: `http://localhost:3000/dashboard/settings?planPayment=${PAYMENT_ID}`, cancelUrl: "http://localhost:3000/dashboard/settings" });
  });

  it("refuses an admin, who does not pay for the school", async () => {
    setStaffRole(staff.clients, "admin");

    const response = await staff.app.inject({ method: "POST", url: "/schools/current/plan/checkout", headers: staff.headers, payload: { plan: "pro", interval: "month", method: "aba_payway" } });

    expect(response.statusCode).toBe(403);
  });

  it("answers 400 for a method that cannot take a plan payment, and for the free plan", async () => {
    setStaffRole(staff.clients, "owner");
    staff.clients.billing.checkout.mockRejectedValue(new PlanPaymentMethodUnavailableError());

    const card = await staff.app.inject({ method: "POST", url: "/schools/current/plan/checkout", headers: staff.headers, payload: { plan: "pro", interval: "month", method: "stripe" } });
    const free = await staff.app.inject({ method: "POST", url: "/schools/current/plan/checkout", headers: staff.headers, payload: { plan: "free", interval: "month", method: "aba_payway" } });

    expect(card.json().type).toBe("urn:reanit:problem:plan-payment-method-unavailable");
    expect(free.statusCode).toBe(400);
  });
});

describe("GET /schools/current/plan/payments/:id", () => {
  it("reads a plan payment's status", async () => {
    setStaffRole(staff.clients, "owner");
    staff.clients.billing.getPlanPayment.mockResolvedValue("paid");

    const response = await staff.app.inject({ method: "GET", url: `/schools/current/plan/payments/${PAYMENT_ID}`, headers: staff.headers });

    expect(response.json()).toEqual({ status: "paid" });
    expect(staff.clients.billing.getPlanPayment).toHaveBeenCalledWith(PAYMENT_ID);
  });

  it("answers 404 for a payment the school does not have", async () => {
    setStaffRole(staff.clients, "owner");
    staff.clients.billing.getPlanPayment.mockRejectedValue(new PlanPaymentNotFoundError());

    const response = await staff.app.inject({ method: "GET", url: `/schools/current/plan/payments/${PAYMENT_ID}`, headers: staff.headers });

    expect(response.statusCode).toBe(404);
  });
});
