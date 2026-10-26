import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createCommerceStore, createDbClient, createReceiptStore } from "../src";
import { openTestSchool } from "../src/test/schools";
import { ONE_TIME, payAtGateway } from "../src/test/payments";

const db = createDbClient(inject("databaseUrl"));
let alphaId: string;
let betaId: string;
let courseId: string;

/**
 * Starts a Khmer buyer's order for the course, and pays it when asked.
 *
 * @param email The buyer's email.
 * @param isPaid Whether the gateway confirms the payment.
 * @returns The order's id.
 */
async function order(email: string, isPaid: boolean) {
  const store = createCommerceStore(db, alphaId);
  const price = (await store.findCourse("receipted"))?.price;
  if (!price) throw new Error("The course has no price.");
  const userId = (await db.user.create({ data: { email, name: "Sokha" } })).id;
  const { id } = await store.createOrder({ userId, price, lines: [{ courseId, amount: price.amount }], bundleId: null, couponId: null, method: "stripe", locale: "km", subscriptionId: null, platformFee: 0 });
  await store.setProviderRef(id, `cs_receipt_${id}`);
  if (isPaid) await payAtGateway(db, "stripe", `cs_receipt_${id}`);
  return id;
}

beforeAll(async () => {
  alphaId = await openTestSchool(db, "receipt-alpha");
  betaId = await openTestSchool(db, "receipt-beta");
  const catalog = createCatalogStore(db, alphaId);
  courseId = (await catalog.createCourse({ title: "Receipted", slug: "receipted" })).id;
  await catalog.updateCourse(courseId, { status: "published" });
  await createCommerceStore(db, alphaId).setPrice(courseId, { amount: 648_000_000, currency: "KHR", billing: ONE_TIME });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("receipt store", () => {
  it("loads a paid order with its language, buyer, school and courses", async () => {
    const id = await order("receipt-paid@example.com", true);

    expect(await createReceiptStore(db, alphaId).findReceipt(id)).toEqual({
      orderId: id,
      locale: "km",
      paidAt: expect.any(Date),
      buyer: { email: "receipt-paid@example.com", name: "Sokha" },
      school: { name: "receipt-alpha", subdomain: "receipt-alpha" },
      items: [{ title: "Receipted", slug: "receipted", amount: 648_000_000, currency: "KHR" }],
      total: { amount: 648_000_000, currency: "KHR" },
    });
  });

  it("has no receipt for an order that is not paid", async () => {
    const id = await order("receipt-pending@example.com", false);

    expect(await createReceiptStore(db, alphaId).findReceipt(id)).toBeNull();
  });

  it("never shows another school's order", async () => {
    const id = await order("receipt-other@example.com", true);

    expect(await createReceiptStore(db, betaId).findReceipt(id)).toBeNull();
  });
});
