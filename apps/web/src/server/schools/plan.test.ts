// @vitest-environment node
import { PLAN_TERMS } from "@reanit/core/schools";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { getPlanPaymentStatus, getSchoolPlan, planPaymentFrom } from "./plan";

vi.mock("next/headers", () => import("@/test/headers"));

const PAYMENT_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a70";

beforeEach(() => {
  signIn();
});

describe("planPaymentFrom", () => {
  it("reads the payment the owner came back from, and nothing from a malformed one", () => {
    expect(planPaymentFrom({ planPayment: PAYMENT_ID })).toBe(PAYMENT_ID);
    expect(planPaymentFrom({ planPayment: "nope" })).toBeNull();
    expect(planPaymentFrom({})).toBeNull();
  });
});

describe("getSchoolPlan", () => {
  it("returns the school's plan with the paid period's end as a date", async () => {
    onApi("GET /schools/current/plan", Response.json({ plan: "pro", terms: PLAN_TERMS.pro, paid: { plan: "pro", interval: "year", periodEnd: "2027-10-27T12:00:00.000Z" }, methods: ["aba_payway"] }));

    expect(await getSchoolPlan()).toEqual({ plan: "pro", terms: PLAN_TERMS.pro, paid: { plan: "pro", interval: "year", periodEnd: new Date("2027-10-27T12:00:00Z") }, methods: ["aba_payway"] });
  });
});

describe("getPlanPaymentStatus", () => {
  it("returns the payment's status", async () => {
    onApi(`GET /schools/current/plan/payments/${PAYMENT_ID}`, Response.json({ status: "paid" }));

    expect(await getPlanPaymentStatus(PAYMENT_ID)).toBe("paid");
  });

  it("is not found for a payment the school does not have", async () => {
    onApi(`GET /schools/current/plan/payments/${PAYMENT_ID}`, problem(404, "urn:reanit:problem:plan-payment-not-found"));

    await expect(getPlanPaymentStatus(PAYMENT_ID)).rejects.toThrow(NotFoundError);
  });
});
