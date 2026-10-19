import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createCommerceStore, createDbClient, createLearningStore, createPaymentConfirmationStore, createStatsStore } from "../src";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
let alphaId: string;
let betaId: string;
let soldId: string;
let unsoldId: string;

/**
 * Sells the course to a new buyer at its current price and confirms the payment.
 *
 * @param email The buyer's email.
 * @returns The buyer's enrollment.
 */
async function sellTo(email: string) {
  const store = createCommerceStore(db, alphaId);
  const price = (await store.findCourse("sold"))?.price;
  if (!price) throw new Error("The course has no price.");
  const userId = (await db.user.create({ data: { email } })).id;
  const { id } = await store.createOrder({ userId, price, lines: [{ courseId: soldId, amount: price.amount }], bundleId: null, couponId: null, method: "stripe", locale: "en" });
  await store.setProviderRef(id, `cs_stats_${id}`);
  await createPaymentConfirmationStore(db).confirm("stripe", `cs_stats_${id}`);
  await createPaymentConfirmationStore(db).confirm("stripe", `cs_stats_${id}`);
  return db.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId, courseId: soldId } }, select: { id: true, courseId: true } });
}

beforeAll(async () => {
  alphaId = await openTestSchool(db, "stats-alpha");
  betaId = await openTestSchool(db, "stats-beta");
  const catalog = createCatalogStore(db, alphaId);
  soldId = (await catalog.createCourse({ title: "Sold", slug: "sold" })).id;
  unsoldId = (await catalog.createCourse({ title: "Unsold", slug: "unsold" })).id;
  const commerce = createCommerceStore(db, alphaId);
  await commerce.setPrice(soldId, { amount: 1_500_000_000, currency: "KHR" });
  const first = await sellTo("stats-buyer-1@example.com");
  await sellTo("stats-buyer-2@example.com");
  await commerce.setPrice(soldId, { amount: 4900, currency: "USD" });
  await sellTo("stats-buyer-3@example.com");
  await createLearningStore(db, alphaId).completeCourse(first, new Date());
});

afterAll(async () => {
  await db.$disconnect();
});

describe("stats store", () => {
  it("sums each course's confirmed sales per currency and its completions, counting each payment once", async () => {
    const stats = await createStatsStore(db, alphaId).listCourseStats();

    expect(stats.find((course) => course.courseId === soldId)).toEqual({
      courseId: soldId,
      title: "Sold",
      slug: "sold",
      students: 3,
      completions: 1,
      // 2 × 15,000,000 riel passes 2^31 minor units.
      revenue: [
        { currency: "KHR", amount: 3_000_000_000 },
        { currency: "USD", amount: 4900 },
      ],
    });
  });

  it("lists a course without sales with zeros", async () => {
    const stats = await createStatsStore(db, alphaId).listCourseStats();

    expect(stats.find((course) => course.courseId === unsoldId)).toEqual({ courseId: unsoldId, title: "Unsold", slug: "unsold", students: 0, completions: 0, revenue: [] });
  });

  it("shows another school none of this school's courses or figures", async () => {
    expect(await createStatsStore(db, betaId).listCourseStats()).toEqual([]);
  });
});
