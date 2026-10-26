import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createCommerceStore, createDbClient, createPaymentConfirmationStore } from "../src";
import { payAtGateway, renewForTest } from "../src/test/payments";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const MONTHLY = { kind: "recurring", interval: "month" } as const;
const PAID_AT = new Date("2026-10-27T09:00:00Z");
let alphaId: string;
let betaId: string;
let courseId: string;

/**
 * Starts a subscription to the monthly course and its first order, paid by the given method.
 *
 * @param email The new buyer's email.
 * @param method How the order is paid.
 * @returns The buyer, subscription and order ids.
 */
async function subscribe(email: string, method: "aba_payway" | "offline_qr" = "aba_payway") {
  const store = createCommerceStore(db, alphaId);
  const userId = (await db.user.create({ data: { email } })).id;
  const course = await store.findCourse("club");
  if (!course?.price) throw new Error("The course has no price.");
  const { id: subscriptionId } = await store.createSubscription({ userId, priceId: course.price.id });
  const { id: orderId } = await store.createOrder({
    userId,
    price: course.price,
    lines: [{ courseId, amount: course.price.amount }],
    bundleId: null,
    couponId: null,
    method,
    locale: "en",
    subscriptionId,
  });
  if (method !== "offline_qr") await store.setProviderRef(orderId, `tran_${orderId}`);
  return { userId, subscriptionId, orderId };
}

beforeAll(async () => {
  alphaId = await openTestSchool(db, "subscriptions-alpha");
  betaId = await openTestSchool(db, "subscriptions-beta");
  courseId = (await createCatalogStore(db, alphaId).createCourse({ title: "Design Club", slug: "club" })).id;
  await createCommerceStore(db, alphaId).setPrice(courseId, { amount: 1500, currency: "USD", billing: MONTHLY });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("prices", () => {
  it("keeps how a price bills", async () => {
    const store = createCommerceStore(db, alphaId);
    const otherId = (await createCatalogStore(db, alphaId).createCourse({ title: "Pro", slug: "pro" })).id;

    expect(await store.setPrice(otherId, { amount: 10_000, currency: "USD", billing: { kind: "payment_plan", installments: 3 } })).toMatchObject({
      billing: { kind: "payment_plan", installments: 3 },
    });
    expect((await store.findCourse("club"))?.price?.billing).toEqual(MONTHLY);
  });
});

describe("subscriptions", () => {
  it("pays the first period: the subscription starts and the enrollment lasts until a week past the period", async () => {
    const { userId, subscriptionId, orderId } = await subscribe("subscriptions-first@example.com");
    const store = createCommerceStore(db, alphaId);
    expect(await store.listSubscriptions(userId)).toEqual([]);

    expect(await payAtGateway(db, "aba_payway", `tran_${orderId}`, PAID_AT)).toEqual({ orderId, isNewlyPaid: true });

    const periodEnd = new Date("2026-11-26T09:00:00Z");
    expect(await store.findSubscription(subscriptionId, userId)).toMatchObject({
      status: "active",
      title: "Design Club",
      courseIds: [courseId],
      paidPeriods: 1,
      currentPeriodEnd: periodEnd,
      price: { amount: 1500, billing: MONTHLY },
    });
    expect((await db.enrollment.findFirstOrThrow({ where: { userId, courseId } })).expiresAt).toEqual(new Date("2026-12-03T09:00:00Z"));
    expect(await db.outboxEvent.count({ where: { type: "OrderPaid", payload: { path: ["orderId"], equals: orderId } } })).toBe(1);
    expect((await store.listSubscriptions(userId)).map(({ id }) => id)).toEqual([subscriptionId]);
  });

  it("renews: the next period's payment extends access and records SubscriptionRenewed", async () => {
    const { userId, subscriptionId, orderId } = await subscribe("subscriptions-renew@example.com");
    await payAtGateway(db, "aba_payway", `tran_${orderId}`, PAID_AT);
    const store = createCommerceStore(db, alphaId);
    // findSubscription found it after the first payment.
    const { price } = (await store.findSubscription(subscriptionId, userId))!;
    const { id: renewalId } = await store.createOrder({ userId, price, lines: [{ courseId, amount: 1500 }], bundleId: null, couponId: null, method: "aba_payway", locale: "en", subscriptionId });
    await store.setProviderRef(renewalId, `tran_${renewalId}`);

    await payAtGateway(db, "aba_payway", `tran_${renewalId}`, new Date("2026-11-20T09:00:00Z"));

    expect(await store.findSubscription(subscriptionId, userId)).toMatchObject({ paidPeriods: 2, currentPeriodEnd: new Date("2026-12-26T09:00:00Z") });
    expect((await db.enrollment.findFirstOrThrow({ where: { userId, courseId } })).expiresAt).toEqual(new Date("2027-01-02T09:00:00Z"));
    expect(await db.outboxEvent.count({ where: { type: "SubscriptionRenewed", payload: { path: ["orderId"], equals: renewalId } } })).toBe(1);
  });

  it("counts a lapsed enrollment as no access", async () => {
    const { userId, orderId } = await subscribe("subscriptions-lapsed@example.com");
    await payAtGateway(db, "aba_payway", `tran_${orderId}`, PAID_AT);
    const store = createCommerceStore(db, alphaId);

    expect(await store.enrolledCourseIds(userId, [courseId], new Date("2026-12-03T08:59:59Z"))).toEqual([courseId]);
    expect(await store.enrolledCourseIds(userId, [courseId], new Date("2026-12-03T09:00:00Z"))).toEqual([]);
  });

  it("never shows another school's subscriptions", async () => {
    const { userId, subscriptionId, orderId } = await subscribe("subscriptions-private@example.com");
    await payAtGateway(db, "aba_payway", `tran_${orderId}`, PAID_AT);
    const beta = createCommerceStore(db, betaId);

    expect(await beta.findSubscription(subscriptionId, userId)).toBeNull();
    expect(await beta.listSubscriptions(userId)).toEqual([]);
  });
});

describe("offline QR payments", () => {
  it("knows whether the school uploaded its payment QR", async () => {
    expect(await createCommerceStore(db, betaId).hasPaymentQr()).toBe(false);
    await db.school.update({ where: { id: betaId }, data: { paymentQrKey: `schools/${betaId}/payment-qr/qr.png` } });

    expect(await createCommerceStore(db, betaId).hasPaymentQr()).toBe(true);
  });

  it("waits for staff once the student says they paid, then confirms by order id and enrolls", async () => {
    const { userId, orderId } = await subscribe("subscriptions-offline@example.com", "offline_qr");
    const store = createCommerceStore(db, alphaId);

    expect(await store.submitOfflinePayment(orderId, userId, "ABA-998877")).toBe(true);
    expect(await store.submitOfflinePayment(orderId, userId, "again")).toBe(false);
    expect(await db.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: "awaiting_confirmation", paymentReference: "ABA-998877" });

    expect(await createPaymentConfirmationStore(db).confirm({ offlineOrderId: orderId }, PAID_AT, renewForTest)).toEqual({ orderId, isNewlyPaid: true });
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("paid");
    expect(await db.enrollment.count({ where: { userId, courseId } })).toBe(1);
  });

  it("fails a rejected offline payment, and never confirms a gateway order by id", async () => {
    const { userId, orderId } = await subscribe("subscriptions-rejected@example.com", "offline_qr");
    const gateway = await subscribe("subscriptions-gateway@example.com");
    const store = createCommerceStore(db, alphaId);
    await store.submitOfflinePayment(orderId, userId, "ABA-1");

    expect(await store.failOrder(orderId)).toBe(true);
    expect(await store.failOrder(orderId)).toBe(false);
    expect(await createPaymentConfirmationStore(db).confirm({ offlineOrderId: gateway.orderId }, PAID_AT, renewForTest)).toBeNull();
  });
});
