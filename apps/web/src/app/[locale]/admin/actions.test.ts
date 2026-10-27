// @vitest-environment node
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DUE_PAYOUT, SUBMITTED_PLAN_PAYMENT } from "@/test/admin";
import { onApi, problem, requestTo } from "@/test/api";
import { formData as form } from "@/test/form";
import { NotFoundError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { decidePlanPayment, recordPayout, suspendSchool, unsuspendSchool } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
// Cache revalidation needs a running Next server; it is a boundary, so record calls instead.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const SCHOOL_ID = DUE_PAYOUT.school.id;
const SUSPENSION_ROUTE = `/admin/schools/${SCHOOL_ID}/suspension`;
const IDLE = { status: "idle" } as const;

beforeEach(() => {
  signIn();
});

describe("suspendSchool and unsuspendSchool", () => {
  it("suspends with the trimmed reason and refreshes the list", async () => {
    onApi(`PUT ${SUSPENSION_ROUTE}`, Response.json({ schoolId: SCHOOL_ID, suspension: { at: "2026-10-27T05:00:00.000Z", reason: "Spam" } }));

    expect(await suspendSchool(SCHOOL_ID, IDLE, form({ reason: " Spam " }))).toEqual(IDLE);
    expect(await requestTo(`PUT ${SUSPENSION_ROUTE}`)?.json()).toEqual({ reason: "Spam" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/schools");
  });

  it("needs a reason, without calling the API", async () => {
    expect(await suspendSchool(SCHOOL_ID, IDLE, form({ reason: "  " }))).toEqual({ status: "invalid" });
    expect(requestTo(`PUT ${SUSPENSION_ROUTE}`)).toBeUndefined();
  });

  it("brings a school back online", async () => {
    onApi(`DELETE ${SUSPENSION_ROUTE}`, Response.json({ schoolId: SCHOOL_ID, suspension: null }));

    await unsuspendSchool(SCHOOL_ID);

    expect(requestTo(`DELETE ${SUSPENSION_ROUTE}`)).toBeDefined();
    expect(revalidatePath).toHaveBeenCalledWith("/admin/schools");
  });

  it("is not found for anyone but a platform admin", async () => {
    onApi(`DELETE ${SUSPENSION_ROUTE}`, problem(403));

    await expect(unsuspendSchool(SCHOOL_ID)).rejects.toThrow(NotFoundError);
  });
});

describe("decidePlanPayment", () => {
  const paymentPath = `/admin/plan-payments/${SUBMITTED_PLAN_PAYMENT.id}`;

  it("confirms or rejects a payment and refreshes the list", async () => {
    onApi(`POST ${paymentPath}/confirm`, Response.json({ payment: { id: SUBMITTED_PLAN_PAYMENT.id, schoolId: SCHOOL_ID, status: "paid" } }));
    onApi(`POST ${paymentPath}/reject`, Response.json({ payment: { id: SUBMITTED_PLAN_PAYMENT.id, schoolId: SCHOOL_ID, status: "failed" } }));

    await decidePlanPayment(SUBMITTED_PLAN_PAYMENT.id, "confirm");
    await decidePlanPayment(SUBMITTED_PLAN_PAYMENT.id, "reject");

    expect([requestTo(`POST ${paymentPath}/confirm`), requestTo(`POST ${paymentPath}/reject`)]).not.toContain(undefined);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/plan-payments");
  });

  it("lets a payment another admin decided meanwhile leave the list", async () => {
    onApi(`POST ${paymentPath}/confirm`, problem(409, "urn:reanit:problem:plan-payment-closed"));

    await decidePlanPayment(SUBMITTED_PLAN_PAYMENT.id, "confirm");

    expect(revalidatePath).toHaveBeenCalledWith("/admin/plan-payments");
  });
});

describe("recordPayout", () => {
  const PAYOUT = { schoolId: SCHOOL_ID, currency: "USD", amount: "46.55", paidAt: "2026-10-31T17:00:00.000Z", reference: " ABA-TRX-1 " };

  it("records the amount in minor units and refreshes the payouts due", async () => {
    onApi("POST /admin/payouts", Response.json({ payout: {} }, { status: 201 }));

    expect(await recordPayout(IDLE, form(PAYOUT))).toEqual({ status: "recorded" });
    expect(await requestTo("POST /admin/payouts")?.json()).toEqual({ schoolId: SCHOOL_ID, currency: "USD", amount: 4655, paidAt: "2026-10-31T17:00:00.000Z", reference: "ABA-TRX-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/payouts");
  });

  it("refuses a malformed amount or day without calling the API, and says when it is more than the balance", async () => {
    expect(await recordPayout(IDLE, form({ ...PAYOUT, amount: "46.555" }))).toEqual({ status: "invalid" });
    expect(await recordPayout(IDLE, form({ ...PAYOUT, paidAt: "" }))).toEqual({ status: "invalid" });
    expect(requestTo("POST /admin/payouts")).toBeUndefined();

    onApi("POST /admin/payouts", problem(409, "urn:reanit:problem:payout-exceeds-balance"));

    expect(await recordPayout(IDLE, form(PAYOUT))).toEqual({ status: "exceeds" });
  });
});
