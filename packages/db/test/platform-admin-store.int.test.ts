import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createDbClient, createPlanBillingStore, createPlanConfirmationStore, createPlatformAdminStore, createSchoolPlanStore, createSchoolStore } from "../src";
import { renewForTest } from "../src/test/payments";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const store = createPlatformAdminStore(db);
const SUSPENDED_AT = new Date("2026-10-27T12:00:00Z");
let alphaId: string;
let betaId: string;

/**
 * Starts a Pro month in the school paid to the platform's QR.
 *
 * @param schoolId The school.
 * @param reference The creator's reference, or none when they have not said they paid.
 * @returns The payment's id.
 */
async function qrPayment(schoolId: string, reference?: string) {
  const billing = createPlanBillingStore(db, schoolId);
  const { id } = await billing.createPlanPayment({ plan: "pro", interval: "month", amount: 2900, method: "offline_qr" });
  if (reference) expect(await billing.submitOfflinePayment(id, reference)).toBe(true);
  return id;
}

beforeAll(async () => {
  alphaId = await openTestSchool(db, "padmin-alpha");
  betaId = await openTestSchool(db, "padmin-beta");
});

afterAll(async () => {
  await db.$disconnect();
});

describe("createPlatformAdminStore", () => {
  it("lists schools newest first, searched by name, subdomain or owner's email, with their plan", async () => {
    const { schools, total } = await store.listSchools({ search: "PADMIN-", limit: 1, offset: 0 });

    expect(total).toBe(2);
    expect(schools).toEqual([
      {
        id: betaId,
        name: "padmin-beta",
        subdomain: "padmin-beta",
        createdAt: expect.any(Date),
        ownerEmail: "padmin-beta@example.com",
        plan: { plan: "free", interval: null, periodEnd: null },
        suspension: null,
      },
    ]);
    expect((await store.listSchools({ search: "padmin-alpha@example", limit: 10, offset: 0 })).schools.map(({ id }) => id)).toEqual([alphaId]);
  });

  it("takes a school offline, so its site is not found, and back online", async () => {
    expect(await store.setSuspension(betaId, { at: SUSPENDED_AT, reason: "Pirated courses" })).toBe(true);

    expect((await store.listSchools({ search: "padmin-beta", limit: 10, offset: 0 })).schools[0]!.suspension).toEqual({ at: SUSPENDED_AT, reason: "Pirated courses" });
    expect(await createSchoolStore(db).findSchoolBySubdomain("padmin-beta")).toBeNull();

    await store.setSuspension(betaId, null);

    expect(await createSchoolStore(db).findSchoolBySubdomain("padmin-beta")).toMatchObject({ id: betaId });
    expect(await store.setSuspension("00000000-0000-4000-8000-000000000000", null)).toBe(false);
  });

  it("lists the QR payments creators said they made, and confirms one once by id, moving the plan on", async () => {
    const submitted = await qrPayment(alphaId, "ABA-123");
    await qrPayment(alphaId);

    expect(await store.listSubmittedPlanPayments()).toEqual([
      { id: submitted, plan: "pro", interval: "month", amount: 2900, reference: "ABA-123", submittedAt: expect.any(Date), school: { id: alphaId, name: "padmin-alpha", subdomain: "padmin-alpha" } },
    ]);
    expect(await store.findPlanPayment(submitted)).toEqual({ schoolId: alphaId, method: "offline_qr", status: "pending" });

    const confirmations = createPlanConfirmationStore(db);
    expect(await confirmations.confirm({ offlinePaymentId: submitted }, SUSPENDED_AT, renewForTest)).toEqual({ paymentId: submitted, isNewlyPaid: true });
    expect(await confirmations.confirm({ offlinePaymentId: submitted }, SUSPENDED_AT, renewForTest)).toEqual({ paymentId: submitted, isNewlyPaid: false });
    expect(await createSchoolPlanStore(db, alphaId).findPlan()).toMatchObject({ plan: "pro", interval: "month" });
    expect(await store.listSubmittedPlanPayments()).toEqual([]);
  });

  it("never confirms a gateway payment by id, and fails only pending payments", async () => {
    const billing = createPlanBillingStore(db, betaId);
    const { id: gatewayPayment } = await billing.createPlanPayment({ plan: "pro", interval: "month", amount: 2900, method: "aba_payway" });
    const rejected = await qrPayment(betaId, "ABA-999");

    expect(await createPlanConfirmationStore(db).confirm({ offlinePaymentId: gatewayPayment }, SUSPENDED_AT, renewForTest)).toBeNull();
    expect(await billing.submitOfflinePayment(gatewayPayment, "X")).toBe(false);
    expect(await store.failPlanPayment(rejected)).toBe(true);
    expect(await store.failPlanPayment(rejected)).toBe(false);
    expect(await billing.findPlanPayment(rejected)).toMatchObject({ status: "failed", reference: "ABA-999" });
  });
});
