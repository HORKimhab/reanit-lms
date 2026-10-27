import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createCommerceStore, createDbClient, createPayoutAdminStore, createPayoutStore } from "../src";
import { ONE_TIME } from "../src/test/payments";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
/** Sales paid at or before this are past their hold. */
const CUTOFF = new Date("2026-10-20T00:00:00Z");
let alphaId: string;
let betaId: string;
let courseId: string;
let adminId: string;

/**
 * Creates a sale of the alpha course with a status, method, fee and payment time.
 *
 * @param sale What to vary.
 * @param sale.method How it was paid.
 * @param sale.status Where it is.
 * @param sale.paidAt When it was paid.
 * @param sale.isRefundedByHand Whether staff refunded it from the school's own money.
 */
async function sale({ method = "aba_payway", status = "paid", paidAt = new Date("2026-10-01T00:00:00Z"), isRefundedByHand = false }: { method?: "aba_payway" | "offline_qr"; status?: "paid" | "refunded" | "pending"; paidAt?: Date; isRefundedByHand?: boolean }) {
  const commerce = createCommerceStore(db, alphaId);
  const course = await commerce.findCourse("paid");
  if (!course?.price) throw new Error("The course has no price.");
  const userId = (await db.user.create({ data: { email: `payouts-${Math.random()}@example.com` } })).id;
  const { id } = await commerce.createOrder({ userId, price: course.price, lines: [{ courseId, amount: 10_000 }], bundleId: null, couponId: null, method, locale: "en", subscriptionId: null, platformFee: 500 });
  await db.order.update({ where: { id }, data: { status, paidAt, isRefundedByHand } });
}

beforeAll(async () => {
  alphaId = await openTestSchool(db, "payouts-alpha");
  betaId = await openTestSchool(db, "payouts-beta");
  courseId = (await createCatalogStore(db, alphaId).createCourse({ title: "Paid", slug: "paid" })).id;
  await createCommerceStore(db, alphaId).setPrice(courseId, { amount: 10_000, currency: "USD", billing: ONE_TIME });
  adminId = (await db.user.create({ data: { email: "payouts-admin@example.com" } })).id;
  await sale({});
  await sale({ status: "refunded", isRefundedByHand: true });
  await sale({ status: "refunded" });
  await sale({ paidAt: new Date("2026-10-25T00:00:00Z") });
  await sale({ method: "offline_qr" });
  await sale({ status: "pending" });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("payout store", () => {
  it("sums gateway sales less fees past their hold, holds newer ones, and takes the fees on the school's own QR sales", async () => {
    // Two gateway sales still held by the platform past the hold (one refunded by hand): 2 × (10,000 − 500) − 500 own-QR fee.
    expect(await createPayoutStore(db, alphaId).balances(CUTOFF)).toEqual([{ currency: "USD", available: 18_500, onHold: 9500 }]);
    expect(await createPayoutStore(db, betaId).balances(CUTOFF)).toEqual([]);
  });

  it("saves the payout details in place of the old ones", async () => {
    const store = createPayoutStore(db, alphaId);
    await store.savePayoutAccount({ holderName: "Sokha", bankName: "ABA Bank", account: "001" });

    await store.savePayoutAccount({ holderName: "Sokha Chan", bankName: "ACLEDA", account: "002" });

    expect(await store.findPayoutAccount()).toEqual({ holderName: "Sokha Chan", bankName: "ACLEDA", account: "002" });
    expect(await createPayoutStore(db, betaId).findPayoutAccount()).toBeNull();
  });
});

describe("payout admin store", () => {
  it("lists every school with a balance, with its payout details", async () => {
    const schools = await createPayoutAdminStore(db).listBalances(CUTOFF);

    expect(schools.find(({ school }) => school.id === alphaId)).toMatchObject({ school: { subdomain: "payouts-alpha" }, balances: [{ currency: "USD", available: 18_500 }] });
    expect(schools.some(({ school }) => school.id === betaId)).toBe(false);
  });

  it("records a payout within the available balance, which then comes off it, and refuses one above it", async () => {
    const admin = createPayoutAdminStore(db);
    const payout = { schoolId: alphaId, currency: "USD" as const, amount: 18_000, paidAt: new Date("2026-11-01T02:00:00Z"), reference: "ABA-TRX-1" };

    expect(await admin.recordPayout(payout, CUTOFF, adminId)).toMatchObject({ amount: 18_000, reference: "ABA-TRX-1" });
    expect(await admin.recordPayout({ ...payout, amount: 501 }, CUTOFF, adminId)).toBeNull();
    expect((await createPayoutStore(db, alphaId).balances(CUTOFF))[0]?.available).toBe(500);
    expect((await createPayoutStore(db, alphaId).listPayouts()).map(({ reference }) => reference)).toEqual(["ABA-TRX-1"]);
    expect(await db.payout.count({ where: { recordedById: adminId } })).toBe(1);
  });

  it("refuses a payout to a school that does not exist", async () => {
    expect(await createPayoutAdminStore(db).recordPayout({ schoolId: "00000000-0000-4000-8000-000000000000", currency: "USD", amount: 1, paidAt: new Date(), reference: "x" }, CUTOFF, adminId)).toBeNull();
  });
});
