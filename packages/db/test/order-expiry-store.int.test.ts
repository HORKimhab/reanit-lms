import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createCommerceStore, createDbClient, createOrderExpiryStore } from "../src";
import { openTestSchool } from "../src/test/schools";
import { ONE_TIME } from "../src/test/payments";

const db = createDbClient(inject("databaseUrl"));
const CUTOFF = new Date("2026-10-26T10:00:00Z");
let schoolIds: string[];
let buyerId: string;

/**
 * Creates an order in a school for its one course, placed at the given time with the given status.
 *
 * @param schoolId The school.
 * @param method The gateway.
 * @param placedAt When it was placed.
 * @param status Where it is.
 * @returns The order's id.
 */
async function order(schoolId: string, method: "stripe" | "bakong_khqr", placedAt: Date, status: "pending" | "paid" = "pending") {
  const commerce = createCommerceStore(db, schoolId);
  const course = await commerce.findCourse("expiring");
  if (!course?.price) throw new Error("The course has no price.");
  const { price } = course;
  const { id } = await commerce.createOrder({ userId: buyerId, price, lines: [{ courseId: course.id, amount: price.amount }], bundleId: null, couponId: null, method, locale: "en", subscriptionId: null, platformFee: 0 });
  await db.order.update({ where: { id }, data: { createdAt: placedAt, status } });
  return id;
}

beforeAll(async () => {
  schoolIds = [await openTestSchool(db, "expiry-alpha"), await openTestSchool(db, "expiry-beta")];
  for (const schoolId of schoolIds) {
    const courseId = (await createCatalogStore(db, schoolId).createCourse({ title: "Expiring", slug: "expiring" })).id;
    await createCommerceStore(db, schoolId).setPrice(courseId, { amount: 100, currency: "USD", billing: ONE_TIME });
  }
  buyerId = (await db.user.create({ data: { email: "expiry-buyer@example.com" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("order expiry store", () => {
  it("fails pending orders placed before their method's cutoff, in every school, and nothing else", async () => {
    const [alpha, beta] = schoolIds as [string, string]; // both schools were opened in beforeAll
    const staleKhqr = await order(alpha, "bakong_khqr", new Date("2026-10-26T09:59:00Z"));
    const staleStripe = await order(beta, "stripe", new Date("2026-10-25T00:00:00Z"));
    const freshKhqr = await order(alpha, "bakong_khqr", new Date("2026-10-26T10:01:00Z"));
    const freshStripe = await order(beta, "stripe", new Date("2026-10-26T09:00:00Z"));
    const paid = await order(alpha, "bakong_khqr", new Date("2026-10-26T08:00:00Z"), "paid");

    const failed = await createOrderExpiryStore(db).failPendingOrders({
      bakong_khqr: CUTOFF,
      stripe: new Date("2026-10-25T10:00:00Z"),
      aba_payway: new Date("2026-10-25T10:00:00Z"),
      offline_qr: new Date("2026-10-19T10:00:00Z"),
    });

    expect(failed).toBe(2);
    const statuses = await db.order.findMany({ where: { id: { in: [staleKhqr, staleStripe, freshKhqr, freshStripe, paid] } }, select: { id: true, status: true } });
    expect(Object.fromEntries(statuses.map(({ id, status }) => [id, status]))).toEqual({
      [staleKhqr]: "failed",
      [staleStripe]: "failed",
      [freshKhqr]: "pending",
      [freshStripe]: "pending",
      [paid]: "paid",
    });
  });
});
