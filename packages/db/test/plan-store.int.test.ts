import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createCommerceStore, createDbClient, createPlanBillingStore, createPlanConfirmationStore, createSchoolPlanStore, createTeamStore } from "../src";
import { ONE_TIME, renewForTest } from "../src/test/payments";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const PAID_AT = new Date("2026-10-27T12:00:00Z");
let alphaId: string;
let betaId: string;

/**
 * Starts a plan payment in the school with a gateway reference.
 *
 * @param schoolId The school.
 * @param plan The plan.
 * @param providerRef The gateway's reference.
 * @returns The payment's id.
 */
async function planPayment(schoolId: string, plan: "pro" | "business", providerRef: string) {
  const billing = createPlanBillingStore(db, schoolId);
  const { id } = await billing.createPlanPayment({ plan, interval: "month", amount: plan === "pro" ? 2900 : 9900, method: "aba_payway" });
  await billing.setProviderRef(id, providerRef);
  return id;
}

beforeAll(async () => {
  alphaId = await openTestSchool(db, "plans-alpha");
  betaId = await openTestSchool(db, "plans-beta");
});

afterAll(async () => {
  await db.$disconnect();
});

describe("plan stores", () => {
  it("starts every school on Free", async () => {
    expect(await createSchoolPlanStore(db, alphaId).findPlan()).toEqual({ plan: "free", interval: null, periodEnd: null });
  });

  it("confirms a plan payment once, moving the school onto the plan, and extends it when paid again", async () => {
    const first = await planPayment(alphaId, "pro", "tran_plan_1");
    const confirmations = createPlanConfirmationStore(db);

    expect(await confirmations.confirm({ method: "aba_payway", providerRef: "tran_plan_1" }, PAID_AT, renewForTest)).toEqual({ paymentId: first, isNewlyPaid: true });
    expect(await confirmations.confirm({ method: "aba_payway", providerRef: "tran_plan_1" }, PAID_AT, renewForTest)).toEqual({ paymentId: first, isNewlyPaid: false });
    expect(await createSchoolPlanStore(db, alphaId).findPlan()).toEqual({ plan: "pro", interval: "month", periodEnd: new Date("2026-11-26T12:00:00Z") });
    expect(await createPlanBillingStore(db, alphaId).findPlanPayment(first)).toMatchObject({ status: "paid", amount: 2900 });

    await planPayment(alphaId, "pro", "tran_plan_2");
    await confirmations.confirm({ method: "aba_payway", providerRef: "tran_plan_2" }, PAID_AT, renewForTest);
    expect((await createSchoolPlanStore(db, alphaId).findPlan()).periodEnd).toEqual(new Date("2026-12-26T12:00:00Z"));
  });

  it("starts another plan at the payment", async () => {
    await planPayment(alphaId, "business", "tran_plan_3");

    await createPlanConfirmationStore(db).confirm({ method: "aba_payway", providerRef: "tran_plan_3" }, PAID_AT, renewForTest);

    expect(await createSchoolPlanStore(db, alphaId).findPlan()).toEqual({ plan: "business", interval: "month", periodEnd: new Date("2026-11-26T12:00:00Z") });
  });

  it("finds nothing for another gateway's reference, and never shows another school's payments", async () => {
    const id = await planPayment(alphaId, "pro", "tran_plan_4");

    expect(await createPlanConfirmationStore(db).confirm({ method: "stripe", providerRef: "tran_plan_4" }, PAID_AT, renewForTest)).toBeNull();
    expect(await createPlanBillingStore(db, betaId).findPlanPayment(id)).toBeNull();
    await createPlanBillingStore(db, alphaId).failPlanPayment(id);
    expect((await createPlanBillingStore(db, alphaId).findPlanPayment(id))?.status).toBe("failed");
  });
});

describe("plan limit counts", () => {
  it("counts published courses other than one, and team seats besides the owner", async () => {
    const catalog = createCatalogStore(db, betaId);
    const published = await catalog.createCourse({ title: "One", slug: "one" });
    await catalog.updateCourse(published.id, { status: "published" });
    await catalog.createCourse({ title: "Draft", slug: "draft" });
    const team = createTeamStore(db, betaId);
    await team.saveInvite({ email: "plans-a@example.com", role: "instructor", tokenHash: "plans-hash-a", expiresAt: PAID_AT });
    await team.saveInvite({ email: "plans-b@example.com", role: "admin", tokenHash: "plans-hash-b", expiresAt: PAID_AT });

    expect(await catalog.countPublishedCourses("00000000-0000-4000-8000-000000000000")).toBe(1);
    expect(await catalog.countPublishedCourses(published.id)).toBe(0);
    expect(await team.countSeats("plans-b@example.com")).toBe(1);
  });
});

describe("platform fee", () => {
  it("keeps the fee an order was created with", async () => {
    const commerce = createCommerceStore(db, betaId);
    const course = await createCatalogStore(db, betaId).createCourse({ title: "Fee", slug: "fee" });
    const price = await commerce.setPrice(course.id, { amount: 4900, currency: "USD", billing: ONE_TIME });
    const userId = (await db.user.create({ data: { email: "plans-fee@example.com" } })).id;

    // setPrice found the course just created.
    const { id } = await commerce.createOrder({ userId, price: price!, lines: [{ courseId: course.id, amount: 4900 }], bundleId: null, couponId: null, method: "aba_payway", locale: "en", subscriptionId: null, platformFee: 245 });

    expect((await db.order.findUniqueOrThrow({ where: { id } })).platformFee).toBe(245);
  });
});

