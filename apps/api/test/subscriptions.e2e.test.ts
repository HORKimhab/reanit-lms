import { beforeAll, describe, expect, it } from "vitest";

import { openSchool, signUp, uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp();
let school: Awaited<ReturnType<typeof openSchool>>;
let base: string;
let course: { id: string; slug: string };

beforeAll(async () => {
  school = await openSchool(e2e().app, uniqueName("club"));
  base = `/schools/by-subdomain/${school.school.subdomain}`;
  course = (await school.agent.post("/courses").send({ title: "Design Club" }).expect(201)).body.course;
  await school.agent.patch(`/courses/${course.id}`).send({ status: "published" }).expect(200);
  await school.agent.put(`/courses/${course.id}/price`).send({ amount: 1500, currency: "USD", billing: { kind: "recurring", interval: "month" } }).expect(200);
});

describe("subscriptions paid by the school's offline QR", () => {
  it("offers the payment QR once uploaded, waits for staff to confirm, then enrolls; a rejected renewal enrolls nothing more", async () => {
    expect((await school.agent.get(`${base}/courses/${course.slug}/offer`).expect(200)).body.methods).not.toContain("offline_qr");

    const { key } = (await school.agent.post("/schools/current/payment-qr-uploads").send({ contentType: "image/png", sizeBytes: 2048 }).expect(201)).body;
    e2e().storage.uploaded.add(key);
    await school.agent.patch("/schools/current").send({ name: school.school.name, brandColor: null, paymentQrKey: key }).expect(200);
    const offer = (await school.agent.get(`${base}/courses/${course.slug}/offer`).expect(200)).body;
    expect(offer.methods[0]).toBe("offline_qr");
    expect(offer.methods).not.toContain("stripe");
    expect(offer.price.billing).toEqual({ kind: "recurring", interval: "month" });

    const { agent: student } = await signUp(e2e().app, uniqueName("club-student"));
    const checkout = (await student.post(`${base}/checkout`).send({ courseSlug: course.slug, method: "offline_qr" }).expect(201)).body;
    expect(checkout.payment).toEqual({ kind: "offline", qrImageUrl: expect.stringContaining(key) });
    await student.post(`${base}/orders/${checkout.orderId}/offline-payment`).send({ reference: "ABA-778899" }).expect(204);
    expect((await school.agent.get(`/orders/${checkout.orderId}`).expect(200)).body.order).toMatchObject({ status: "awaiting_confirmation", paymentReference: "ABA-778899" });
    await student.get(`${base}/learn/${course.slug}`).expect(403);

    await school.agent.post(`/orders/${checkout.orderId}/confirm-payment`).expect(204);
    await student.get(`${base}/learn/${course.slug}`).expect(200);
    const [subscription] = (await student.get(`${base}/subscriptions`).expect(200)).body.subscriptions;
    expect(subscription).toMatchObject({ status: "active", title: "Design Club", paidPeriods: 1 });

    const renewal = (await student.post(`${base}/subscriptions/${subscription.id}/renew`).send({ method: "offline_qr" }).expect(201)).body;
    await school.agent.post(`/orders/${renewal.orderId}/reject-payment`).expect(204);
    expect((await school.agent.get(`/orders/${renewal.orderId}`).expect(200)).body.order.status).toBe("failed");
    expect((await student.get(`${base}/subscriptions`).expect(200)).body.subscriptions[0].paidPeriods).toBe(1);

    const actions = (await school.agent.get("/audit-events").expect(200)).body.entries.map(({ action }: { action: string }) => action);
    expect(actions).toEqual(expect.arrayContaining(["order.payment.confirm", "order.payment.reject"]));
  });

  it("refuses card payments and coupons for a subscription", async () => {
    const { agent: student } = await signUp(e2e().app, uniqueName("club-card"));

    await student.post(`${base}/checkout`).send({ courseSlug: course.slug, method: "stripe" }).expect(400);
    await student.post(`${base}/checkout`).send({ courseSlug: course.slug, method: "offline_qr", couponCode: "SAVE20" }).expect(400);
  });
});
