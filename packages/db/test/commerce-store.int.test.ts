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
 * @returns The order's id and reference.
 */
async function pendingOrder(userId: string) {
  const store = createCommerceStore(db, alphaId);
  const price = (await store.findCourse("sold"))?.price;
  if (!price) throw new Error("The course has no price.");
  const { id } = await store.createOrder({ userId, courseId, price, method: "stripe" });
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
