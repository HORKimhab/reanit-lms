import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createCommerceStore, createDbClient, createPaymentConfirmationStore } from "../src";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const confirmations = createPaymentConfirmationStore(db);
let alphaId: string;
let betaId: string;
let courseId: string;
let buyerId: string;

/**
 * Creates a buyer's pending order for the course with a fresh gateway reference.
 *
 * @param userId The buyer.
 * @param coupon The coupon used and what the order charges with it; full price without one.
 * @param coupon.id The coupon.
 * @param coupon.amount What the order charges.
 * @returns The order's id and reference.
 */
async function pendingOrder(userId: string, coupon?: { id: string; amount: number }) {
  const store = createCommerceStore(db, alphaId);
  const price = (await store.findCourse("sold"))?.price;
  if (!price) throw new Error("The course has no price.");
  const { id } = await store.createOrder({
    userId,
    courseId,
    price,
    amount: coupon?.amount ?? price.amount,
    couponId: coupon?.id ?? null,
    method: "stripe",
    locale: "en",
  });
  const providerRef = `cs_${randomUUID()}`;
  await store.setProviderRef(id, providerRef);
  return { id, providerRef };
}

beforeAll(async () => {
  alphaId = await openTestSchool(db, "commerce-alpha");
  betaId = await openTestSchool(db, "commerce-beta");
  const catalog = createCatalogStore(db, alphaId);
  courseId = (await catalog.createCourse({ title: "Sold", slug: "sold" })).id;
  await catalog.updateCourse(courseId, { status: "published" });
  buyerId = (await db.user.create({ data: { email: "commerce-buyer@example.com" } })).id;
  const store = createCommerceStore(db, alphaId);
  await store.setPrice(courseId, { amount: 2900, currency: "USD" });
  await store.setPrice(courseId, { amount: 4900, currency: "USD" });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("commerce store", () => {
  it("loads a published course with its newest price", async () => {
    expect(await createCommerceStore(db, alphaId).findCourse("sold")).toEqual({
      id: courseId,
      title: "Sold",
      isPublished: true,
      price: { id: expect.any(String), amount: 4900, currency: "USD" },
    });
  });

  it("shows and lets another school price nothing of this school's", async () => {
    const beta = createCommerceStore(db, betaId);

    expect(await beta.findCourse("sold")).toBeNull();
    expect(await beta.setPrice(courseId, { amount: 1, currency: "USD" })).toBeNull();
  });

  it("creates a pending order its buyer can read and others cannot", async () => {
    const { id, providerRef } = await pendingOrder(buyerId);
    const store = createCommerceStore(db, alphaId);

    expect(await store.findOrder(id, buyerId)).toEqual({ id, status: "pending", courseId, amount: 4900, currency: "USD", method: "stripe", providerRef });
    expect(await store.findOrder(id, randomUUID())).toBeNull();
    expect(await createCommerceStore(db, betaId).findOrder(id, buyerId)).toBeNull();
  });
});

describe("payment confirmation store", () => {
  it("marks the order paid and enrolls the buyer once, however often it is confirmed", async () => {
    const buyer = (await db.user.create({ data: { email: "commerce-once@example.com" } })).id;
    const { id, providerRef } = await pendingOrder(buyer);

    expect(await confirmations.confirm("stripe", providerRef)).toEqual({ orderId: id, isNewlyPaid: true });
    expect(await confirmations.confirm("stripe", providerRef)).toEqual({ orderId: id, isNewlyPaid: false });

    expect(await createCommerceStore(db, alphaId).isEnrolled(buyer, courseId)).toBe(true);
    expect(await db.enrollment.count({ where: { userId: buyer, courseId } })).toBe(1);
    expect((await createCommerceStore(db, alphaId).findOrder(id, buyer))?.status).toBe("paid");
    expect(await db.outboxEvent.findMany({ where: { type: "OrderPaid", payload: { path: ["orderId"], equals: id } }, select: { schoolId: true, payload: true } })).toEqual([
      { schoolId: alphaId, payload: { orderId: id, userId: buyer, courseIds: [courseId] } },
    ]);
  });

  it("lets only one of two concurrent confirmations pay the order", async () => {
    const buyer = (await db.user.create({ data: { email: "commerce-race@example.com" } })).id;
    const { providerRef } = await pendingOrder(buyer);

    const results = await Promise.all([confirmations.confirm("stripe", providerRef), confirmations.confirm("stripe", providerRef)]);

    expect(results.filter((result) => result?.isNewlyPaid)).toHaveLength(1);
    expect(await db.enrollment.count({ where: { userId: buyer, courseId } })).toBe(1);
  });

  it("ignores a reference from another gateway or that no order has", async () => {
    const { providerRef } = await pendingOrder((await db.user.create({ data: { email: "commerce-other@example.com" } })).id);

    expect(await confirmations.confirm("aba_payway", providerRef)).toBeNull();
    expect(await confirmations.confirm("stripe", "cs_unknown")).toBeNull();
  });
});

describe("coupons", () => {
  const SAVE20 = { code: "SAVE20", kind: "percent", percentOff: 20, expiresAt: null, maxRedemptions: 5 } as const;

  it("creates, finds and lists a school's coupons, refusing a code it already has", async () => {
    const store = createCommerceStore(db, alphaId);
    const expiresAt = new Date("2027-01-01T00:00:00Z");

    const percent = await store.createCoupon(SAVE20);
    const fixed = await store.createCoupon({ code: "RIEL5K", kind: "fixed", amountOff: 500_000, currency: "KHR", expiresAt, maxRedemptions: null });

    expect(percent).toEqual({ ...SAVE20, id: expect.any(String), redemptions: 0 });
    expect(await store.findCoupon("RIEL5K")).toEqual({ ...fixed, expiresAt });
    expect((await store.listCoupons()).map(({ code }) => code)).toEqual(["RIEL5K", "SAVE20"]);
    expect(await store.createCoupon({ ...SAVE20, percentOff: 50 })).toBeNull();
  });

  it("hides a school's coupons from another school, which can reuse the code", async () => {
    const beta = createCommerceStore(db, betaId);
    const alphaCoupon = await createCommerceStore(db, alphaId).findCoupon("SAVE20");

    expect(await beta.findCoupon("SAVE20")).toBeNull();
    expect(await beta.deleteCoupon(alphaCoupon?.id ?? "")).toBe(false);
    expect(await beta.createCoupon(SAVE20)).toMatchObject({ code: "SAVE20" });
  });

  it("refuses a percent coupon that would make a course free", async () => {
    await expect(createCommerceStore(db, alphaId).createCoupon({ ...SAVE20, code: "FREE", percentOff: 100 })).rejects.toThrow();
  });

  it("counts paid orders as redemptions and charges the discounted amount", async () => {
    const store = createCommerceStore(db, alphaId);
    const coupon = await store.createCoupon({ ...SAVE20, code: "COUNTED" });
    if (!coupon) throw new Error("The code is taken.");
    const buyer = (await db.user.create({ data: { email: "commerce-coupon@example.com" } })).id;
    const paid = await pendingOrder(buyer, { id: coupon.id, amount: 3920 });
    await pendingOrder((await db.user.create({ data: { email: "commerce-coupon-pending@example.com" } })).id, { id: coupon.id, amount: 3920 });
    await confirmations.confirm("stripe", paid.providerRef);

    expect((await store.findCoupon("COUNTED"))?.redemptions).toBe(1);
    expect((await store.findOrder(paid.id, buyer))?.amount).toBe(3920);
    expect(await db.orderItem.findFirst({ where: { orderId: paid.id }, select: { amount: true } })).toEqual({ amount: 3920 });
  });

  it("deletes a coupon and keeps the discounted orders that used it", async () => {
    const store = createCommerceStore(db, alphaId);
    const coupon = await store.createCoupon({ ...SAVE20, code: "GONE" });
    if (!coupon) throw new Error("The code is taken.");
    const buyer = (await db.user.create({ data: { email: "commerce-gone@example.com" } })).id;
    const order = await pendingOrder(buyer, { id: coupon.id, amount: 3920 });

    expect(await store.deleteCoupon(coupon.id)).toBe(true);

    expect(await store.findCoupon("GONE")).toBeNull();
    expect(await db.order.findUnique({ where: { id: order.id }, select: { couponId: true, totalAmount: true } })).toEqual({ couponId: null, totalAmount: 3920 });
  });
});
