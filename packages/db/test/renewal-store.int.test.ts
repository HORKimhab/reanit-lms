import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createCommerceStore, createDbClient, createRenewalNoticeStore, createRenewalSweepStore } from "../src";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
let alphaId: string;
let betaId: string;
let priceId: string;
let courseId: string;

/**
 * Creates an active monthly subscription whose period ends at the given time, with one paid order in Khmer.
 *
 * @param email The student's unique email.
 * @param currentPeriodEnd When its period ends.
 * @returns The subscription's and student's ids.
 */
async function activeSubscription(email: string, currentPeriodEnd: Date) {
  const userId = (await db.user.create({ data: { email, name: "Sokha" } })).id;
  const { id } = await db.subscription.create({ data: { schoolId: alphaId, userId, priceId, status: "active", paidPeriods: 1, currentPeriodEnd } });
  await db.order.create({
    data: { schoolId: alphaId, userId, totalAmount: 1500, currency: "USD", paymentMethod: "aba_payway", locale: "km", status: "paid", subscriptionId: id },
  });
  return { id, userId };
}

/**
 * Counts a subscription's events of a type.
 *
 * @param type The event type.
 * @param subscriptionId The subscription.
 * @returns How many.
 */
function eventsOf(type: string, subscriptionId: string) {
  return db.outboxEvent.count({ where: { type, payload: { path: ["subscriptionId"], equals: subscriptionId } } });
}

beforeAll(async () => {
  alphaId = await openTestSchool(db, "renewals-alpha");
  betaId = await openTestSchool(db, "renewals-beta");
  courseId = (await createCatalogStore(db, alphaId).createCourse({ title: "Design Club", slug: "club" })).id;
  const price = await createCommerceStore(db, alphaId).setPrice(courseId, { amount: 1500, currency: "USD", billing: { kind: "recurring", interval: "month" } });
  // setPrice found the course just created.
  priceId = price!.id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("renewal sweep store", () => {
  it("notices a renewal due once per period, and again after the period moves on", async () => {
    const { id } = await activeSubscription("renewals-due@example.com", new Date("2026-10-29T00:00:00Z"));
    const store = createRenewalSweepStore(db);
    const cutoff = new Date("2026-10-30T00:00:00Z");

    expect(await store.noticeRenewals(cutoff)).toBeGreaterThanOrEqual(1);
    await store.noticeRenewals(cutoff);
    expect(await eventsOf("SubscriptionRenewalDue", id)).toBe(1);

    await db.subscription.update({ where: { id }, data: { currentPeriodEnd: new Date("2026-11-29T00:00:00Z") } });
    await store.noticeRenewals(new Date("2026-11-30T00:00:00Z"));
    expect(await eventsOf("SubscriptionRenewalDue", id)).toBe(2);
  });

  it("leaves a subscription ending later alone", async () => {
    const { id } = await activeSubscription("renewals-later@example.com", new Date("2026-12-31T00:00:00Z"));

    await createRenewalSweepStore(db).noticeRenewals(new Date("2026-10-30T00:00:00Z"));

    expect(await eventsOf("SubscriptionRenewalDue", id)).toBe(0);
  });

  it("reminds on the last grace day separately from the renewal notice", async () => {
    const { id } = await activeSubscription("renewals-last@example.com", new Date("2026-10-20T00:00:00Z"));
    const store = createRenewalSweepStore(db);

    await store.noticeRenewals(new Date("2026-10-30T00:00:00Z"));
    await store.noticeLastGraceDays(new Date("2026-10-21T00:00:00Z"));
    await store.noticeLastGraceDays(new Date("2026-10-21T00:00:00Z"));

    const events = await db.outboxEvent.findMany({ where: { type: "SubscriptionRenewalDue", payload: { path: ["subscriptionId"], equals: id } }, select: { payload: true } });
    expect(events.map(({ payload }) => (payload as { isLastDay: boolean }).isLastDay).sort()).toEqual([false, true]);
  });

  it("lapses a subscription past its grace period, once, with its courses", async () => {
    const { id, userId } = await activeSubscription("renewals-lapsed@example.com", new Date("2026-10-01T00:00:00Z"));
    const store = createRenewalSweepStore(db);

    expect(await store.lapseSubscriptions(new Date("2026-10-20T00:00:00Z"))).toBeGreaterThanOrEqual(1);
    await store.lapseSubscriptions(new Date("2026-10-20T00:00:00Z"));

    expect((await db.subscription.findUniqueOrThrow({ where: { id } })).status).toBe("lapsed");
    expect(await db.outboxEvent.findMany({ where: { type: "SubscriptionLapsed", payload: { path: ["subscriptionId"], equals: id } }, select: { schoolId: true, payload: true } })).toEqual([
      { schoolId: alphaId, payload: { subscriptionId: id, userId, courseIds: [courseId] } },
    ]);
  });
});

describe("renewal notice store", () => {
  it("describes a subscription for its email, in the language of its last order", async () => {
    const { id } = await activeSubscription("renewals-notice@example.com", new Date("2026-11-01T09:00:00Z"));

    expect(await createRenewalNoticeStore(db, alphaId).findRenewalNotice(id)).toEqual({
      locale: "km",
      student: { email: "renewals-notice@example.com", name: "Sokha" },
      school: { name: "renewals-alpha", subdomain: "renewals-alpha" },
      title: "Design Club",
      price: { amount: 1500, currency: "USD" },
      billing: { kind: "recurring", interval: "month" },
      paidPeriods: 1,
      status: "active",
      currentPeriodEnd: new Date("2026-11-01T09:00:00Z"),
    });
  });

  it("never describes another school's subscription", async () => {
    const { id } = await activeSubscription("renewals-private@example.com", new Date("2026-11-01T09:00:00Z"));

    expect(await createRenewalNoticeStore(db, betaId).findRenewalNotice(id)).toBeNull();
  });
});
