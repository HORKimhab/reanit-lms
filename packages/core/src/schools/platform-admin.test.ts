import { beforeEach, describe, expect, it } from "vitest";

import { createPaymentConfirmation } from "../commerce";
import { FakeClock } from "../test/auth-fakes";
import { FakeCommerceStore, FakeConfirmationStore } from "../test/commerce-fakes";
import { FakePlanConfirmationStore, FakePlatformAdminStore } from "../test/plan-fakes";
import { PlanPaymentClosedError, PlanPaymentNotFoundError, SchoolNotFoundError } from "./errors";
import { createPlatformAdmin, platformSchoolsQuerySchema, suspendSchoolSchema, type PlatformAdmin, type StoredPlatformSchool } from "./platform-admin";

const NOW = new Date("2026-10-27T12:00:00Z");

/**
 * Builds a stored school.
 *
 * @param overrides Fields to change from a Free school.
 * @returns The school.
 */
function school(overrides: Partial<StoredPlatformSchool> = {}): StoredPlatformSchool {
  return {
    id: "school-1",
    name: "Angkor Academy",
    subdomain: "angkor",
    createdAt: new Date("2026-01-05T00:00:00Z"),
    ownerEmail: "sokha@example.com",
    plan: { plan: "free", interval: null, periodEnd: null },
    suspension: null,
    ...overrides,
  };
}

let store: FakePlatformAdminStore;
let admin: PlatformAdmin;

beforeEach(() => {
  store = new FakePlatformAdminStore([school(), school({ id: "school-2", name: "Mekong Code", subdomain: "mekong", ownerEmail: "dara@example.com" })]);
  const clock = new FakeClock(NOW);
  const confirmation = createPaymentConfirmation({ store: new FakeConfirmationStore(new FakeCommerceStore()), plans: new FakePlanConfirmationStore(store.billing), clock });
  admin = createPlatformAdmin({ store, confirmOfflinePlan: confirmation.confirmOfflinePlan, clock });
});

describe("listSchools", () => {
  it("pages the schools matching the search, treating a blank search as everyone", async () => {
    const page = await admin.listSchools(platformSchoolsQuerySchema.parse({ q: "  ", page: "2" }));

    expect(store.lastQuery).toEqual({ search: null, limit: 50, offset: 50 });
    expect(page).toEqual({ schools: [], total: 2, page: 2, pageSize: 50 });
    expect((await admin.listSchools(platformSchoolsQuerySchema.parse({ q: "dara" }))).schools.map(({ id }) => id)).toEqual(["school-2"]);
  });

  it("gives each school's plan in force, with the paid period's end only while it lasts", async () => {
    store.schools[0]!.plan = { plan: "pro", interval: "month", periodEnd: new Date("2026-11-01T00:00:00Z") };
    store.schools[1]!.plan = { plan: "business", interval: "year", periodEnd: new Date("2026-09-01T00:00:00Z") };

    const { schools } = await admin.listSchools({ page: 1 });

    expect(schools.map(({ plan, paidUntil }) => ({ plan, paidUntil }))).toEqual([
      { plan: "pro", paidUntil: new Date("2026-11-01T00:00:00Z") },
      { plan: "free", paidUntil: null },
    ]);
  });
});

describe("suspension", () => {
  it("takes a school offline with the reason and the time, then back online", async () => {
    expect(await admin.suspendSchool("school-2", suspendSchoolSchema.parse({ reason: " Selling pirated courses " }))).toEqual({ at: NOW, reason: "Selling pirated courses" });
    expect(store.schools[1]!.suspension).toEqual({ at: NOW, reason: "Selling pirated courses" });

    await admin.unsuspendSchool("school-2");

    expect(store.schools[1]!.suspension).toBeNull();
  });

  it("throws SchoolNotFoundError for an unknown school, and needs a reason", async () => {
    await expect(admin.suspendSchool("school-404", { reason: "x" })).rejects.toThrow(SchoolNotFoundError);
    await expect(admin.unsuspendSchool("school-404")).rejects.toThrow(SchoolNotFoundError);
    expect(suspendSchoolSchema.safeParse({ reason: "  " }).success).toBe(false);
  });
});

describe("plan payments to the platform's QR", () => {
  /**
   * Stores a pending Pro month paid to the platform's QR.
   *
   * @param reference The creator's reference, or none when they have not said they paid.
   * @returns The payment's id.
   */
  async function qrPayment(reference?: string) {
    const { id } = await store.billing.createPlanPayment({ plan: "pro", interval: "month", amount: 2_900, method: "offline_qr" });
    if (reference) await store.billing.submitOfflinePayment(id, reference);
    return id;
  }

  it("lists only the payments whose creator gave a reference", async () => {
    const submitted = await qrPayment("ABA-123");
    await qrPayment();

    expect(await admin.listPlanPayments()).toEqual([
      { id: submitted, school: { id: "school-1", name: "Angkor Academy", subdomain: "angkor" }, plan: "pro", interval: "month", amount: 2_900, reference: "ABA-123", submittedAt: expect.any(Date) },
    ]);
  });

  it("confirms a payment, moving its school's plan on", async () => {
    const paymentId = await qrPayment("ABA-123");

    expect(await admin.confirmPlanPayment(paymentId)).toEqual({ schoolId: "school-1" });

    expect(store.billing.stored).toMatchObject({ plan: "pro", interval: "month" });
    await expect(admin.confirmPlanPayment(paymentId)).rejects.toThrow(PlanPaymentClosedError);
  });

  it("rejects a payment, leaving the plan as it was", async () => {
    const paymentId = await qrPayment("ABA-123");

    expect(await admin.rejectPlanPayment(paymentId)).toEqual({ schoolId: "school-1" });

    expect(store.billing.payments[0]!.status).toBe("failed");
    expect(store.billing.stored.plan).toBe("free");
    await expect(admin.rejectPlanPayment(paymentId)).rejects.toThrow(PlanPaymentClosedError);
  });

  it("refuses gateway payments and unknown ones", async () => {
    const { id } = await store.billing.createPlanPayment({ plan: "pro", interval: "month", amount: 2_900, method: "aba_payway" });

    await expect(admin.confirmPlanPayment(id)).rejects.toThrow(PlanPaymentClosedError);
    await expect(admin.rejectPlanPayment(id)).rejects.toThrow(PlanPaymentClosedError);
    await expect(admin.confirmPlanPayment("plan-payment-404")).rejects.toThrow(PlanPaymentNotFoundError);
  });
});
