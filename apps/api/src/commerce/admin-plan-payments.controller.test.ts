import { PlanPaymentClosedError } from "@reanit/core/schools";
import { describe, expect, it } from "vitest";

import { useTestApp } from "../test/app";
import { PLATFORM_ADMIN_USER as ADMIN, signInAs, TEST_SCHOOL } from "../test/session";

const test = useTestApp();
const PAYMENT_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a70";
const SCHOOL = { id: TEST_SCHOOL.id, name: TEST_SCHOOL.name, subdomain: TEST_SCHOOL.subdomain };

describe("GET /admin/plan-payments", () => {
  it("lists the payments to the platform's QR waiting for a platform admin", async () => {
    const headers = signInAs(test.clients, ADMIN);
    const payment = { id: PAYMENT_ID, school: SCHOOL, plan: "pro", interval: "month", amount: 2900, reference: "ABA-123" };
    test.clients.platformAdmin.listPlanPayments.mockResolvedValue([{ ...payment, submittedAt: new Date("2026-10-27T09:00:00Z") }]);

    const response = await test.app.inject({ method: "GET", url: "/admin/plan-payments", headers });

    expect(response.json()).toEqual({ payments: [{ ...payment, submittedAt: "2026-10-27T09:00:00.000Z" }] });
  });

  it("refuses anyone else", async () => {
    const headers = signInAs(test.clients);

    expect((await test.app.inject({ method: "GET", url: "/admin/plan-payments", headers })).statusCode).toBe(403);
  });
});

describe("POST /admin/plan-payments/:id/confirm and /reject", () => {
  it("confirms a payment, auditing it in its school's log", async () => {
    const headers = signInAs(test.clients, ADMIN);
    test.clients.platformAdmin.confirmPlanPayment.mockResolvedValue({ schoolId: TEST_SCHOOL.id });

    const response = await test.app.inject({ method: "POST", url: `/admin/plan-payments/${PAYMENT_ID}/confirm`, headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ payment: { id: PAYMENT_ID, schoolId: TEST_SCHOOL.id, status: "paid" } });
    expect(test.clients.platformAdmin.confirmPlanPayment).toHaveBeenCalledWith(PAYMENT_ID);
    expect(test.clients.auditFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(test.clients.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "plan_payment.confirm", actorId: ADMIN.id, targetId: PAYMENT_ID }));
  });

  it("rejects a payment, audited", async () => {
    const headers = signInAs(test.clients, ADMIN);
    test.clients.platformAdmin.rejectPlanPayment.mockResolvedValue({ schoolId: TEST_SCHOOL.id });

    const response = await test.app.inject({ method: "POST", url: `/admin/plan-payments/${PAYMENT_ID}/reject`, headers });

    expect(response.json()).toEqual({ payment: { id: PAYMENT_ID, schoolId: TEST_SCHOOL.id, status: "failed" } });
    expect(test.clients.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "plan_payment.reject" }));
  });

  it("answers 409 for a payment no longer waiting", async () => {
    const headers = signInAs(test.clients, ADMIN);
    test.clients.platformAdmin.confirmPlanPayment.mockRejectedValue(new PlanPaymentClosedError());

    const response = await test.app.inject({ method: "POST", url: `/admin/plan-payments/${PAYMENT_ID}/confirm`, headers });

    expect(response.json()).toMatchObject({ status: 409, type: "urn:reanit:problem:plan-payment-closed" });
    expect(test.clients.audit.record).not.toHaveBeenCalled();
  });
});
