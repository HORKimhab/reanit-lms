import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createCommerceStore, createDbClient, createOrderHistoryStore } from "../src";
import { openTestSchool } from "../src/test/schools";
import { ONE_TIME } from "../src/test/payments";

const db = createDbClient(inject("databaseUrl"));
const WINDOW = { limit: 50, offset: 0 };
let alphaId: string;
let betaId: string;
let brandId: string;
let socialId: string;
let sokhaId: string;
let daraId: string;

/**
 * Creates an order for one course at its price, placed at the given time.
 *
 * @param courseId The course.
 * @param userId The buyer.
 * @param placedAt When it was placed.
 * @param status Where it is.
 * @returns The order's id.
 */
async function order(courseId: string, userId: string, placedAt: Date, status: "pending" | "paid" | "refunded" = "paid") {
  const commerce = createCommerceStore(db, alphaId);
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, select: { slug: true } });
  const price = (await commerce.findCourse(course.slug))?.price;
  if (!price) throw new Error("The course has no price.");
  const { id } = await commerce.createOrder({ userId, price, lines: [{ courseId, amount: price.amount }], bundleId: null, couponId: null, method: "stripe", locale: "en", subscriptionId: null });
  await db.order.update({ where: { id }, data: { status, createdAt: placedAt, paidAt: status === "pending" ? null : placedAt } });
  return id;
}

beforeAll(async () => {
  alphaId = await openTestSchool(db, "history-alpha");
  betaId = await openTestSchool(db, "history-beta");
  const catalog = createCatalogStore(db, alphaId);
  const commerce = createCommerceStore(db, alphaId);
  brandId = (await catalog.createCourse({ title: "Brand", slug: "brand" })).id;
  socialId = (await catalog.createCourse({ title: "Social", slug: "social" })).id;
  await commerce.setPrice(brandId, { amount: 4900, currency: "USD", billing: ONE_TIME });
  await commerce.setPrice(socialId, { amount: 200_000, currency: "KHR", billing: ONE_TIME });
  sokhaId = (await db.user.create({ data: { email: "history-sokha@example.com", name: "Sokha" } })).id;
  daraId = (await db.user.create({ data: { email: "history-dara@example.com" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("order history store", () => {
  it("lists a buyer's orders newest first with their courses and buyer", async () => {
    const older = await order(brandId, sokhaId, new Date("2026-10-01T08:00:00Z"));
    const newer = await order(socialId, sokhaId, new Date("2026-10-05T08:00:00Z"), "pending");
    await order(brandId, daraId, new Date("2026-10-03T08:00:00Z"));
    const store = createOrderHistoryStore(db, alphaId);

    const { orders, total } = await store.listOrders({ userId: sokhaId }, WINDOW);

    expect(total).toBe(2);
    expect(orders.map(({ id }) => id)).toEqual([newer, older]);
    expect(orders[1]).toMatchObject({
      status: "paid",
      method: "stripe",
      total: { amount: 4900, currency: "USD" },
      items: [{ courseId: brandId, title: "Brand", amount: 4900, currency: "USD" }],
      bundleTitle: null,
      couponCode: null,
      buyer: { id: sokhaId, name: "Sokha", email: "history-sokha@example.com" },
      refundedAt: null,
      isRefundedByHand: false,
    });
  });

  it("filters by status, course, currency and the time placed", async () => {
    const refunded = await order(socialId, daraId, new Date("2026-09-15T08:00:00Z"), "refunded");
    const store = createOrderHistoryStore(db, alphaId);

    expect((await store.listOrders({ status: "refunded" }, WINDOW)).orders.map(({ id }) => id)).toEqual([refunded]);
    expect((await store.listOrders({ courseId: socialId, currency: "KHR", userId: daraId }, WINDOW)).orders.map(({ id }) => id)).toEqual([refunded]);
    const september = await store.listOrders({ placedFrom: new Date("2026-09-01T00:00:00Z"), placedBefore: new Date("2026-10-01T00:00:00Z") }, WINDOW);
    expect(september.orders.map(({ id }) => id)).toEqual([refunded]);
  });

  it("pages with the total of every match", async () => {
    const { orders, total } = await createOrderHistoryStore(db, alphaId).listOrders({}, { limit: 1, offset: 1 });

    expect(orders).toHaveLength(1);
    expect(total).toBeGreaterThan(1);
  });

  it("never returns another school's orders", async () => {
    const id = await order(brandId, sokhaId, new Date("2026-10-10T08:00:00Z"));
    const beta = createOrderHistoryStore(db, betaId);

    expect(await beta.findOrder(id)).toBeNull();
    expect((await beta.listOrders({}, WINDOW)).total).toBe(0);
    expect((await createOrderHistoryStore(db, alphaId).findOrder(id))?.id).toBe(id);
  });
});
