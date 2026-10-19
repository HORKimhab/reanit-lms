import { randomUUID } from "node:crypto";

import Stripe from "stripe";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { TEST_ENV } from "../src/test/app";
import { openSchool, signUp, uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp();
const stripe = new Stripe("sk_test_reanit");
let alpha: Awaited<ReturnType<typeof openSchool>>;
let course: { id: string; slug: string };

/**
 * Sends Stripe's "session paid" webhook for an order, signed like Stripe signs it.
 *
 * @param orderId The order whose session was paid.
 * @returns The response.
 */
function paidWebhook(orderId: string) {
  const payload = JSON.stringify({
    id: `evt_${randomUUID()}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: { object: "checkout.session", id: `cs_e2e_${orderId}`, payment_status: "paid" } },
  });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: TEST_ENV.STRIPE_WEBHOOK_SECRET ?? "" });
  return request(e2e().app.getHttpServer())
    .post("/webhooks/stripe")
    .set("content-type", "application/json")
    .set("stripe-signature", signature)
    .send(payload);
}

beforeAll(async () => {
  alpha = await openSchool(e2e().app, uniqueName("shop"));
  course = (await alpha.agent.post("/courses").send({ title: "Paid Course" }).expect(201)).body.course;
  await alpha.agent.patch(`/courses/${course.id}`).send({ status: "published" }).expect(200);
});

describe("checkout", () => {
  it("sells a priced course and enrolls the buyer only once Stripe confirms, exactly once", async () => {
    const base = `/schools/by-subdomain/${alpha.school.subdomain}`;
    const anonymous = request(e2e().app.getHttpServer());

    expect((await anonymous.get(`${base}/courses/${course.slug}/offer`).expect(200)).body).toEqual({ price: null, methods: [], discount: null });
    await alpha.agent.put(`/courses/${course.id}/price`).send({ amount: 4900, currency: "USD" }).expect(200);
    expect((await anonymous.get(`${base}/courses/${course.slug}/offer`).expect(200)).body).toEqual({
      price: { amount: 4900, currency: "USD" },
      methods: ["aba_payway", "stripe"],
      discount: null,
    });

    const { agent: buyer } = await signUp(e2e().app, uniqueName("buyer"));
    const checkout = await buyer.post(`${base}/checkout`).send({ courseSlug: course.slug, method: "stripe" }).expect(201);
    const { orderId } = checkout.body;
    expect(checkout.body.payment).toEqual({ kind: "redirect", url: `https://checkout.stripe.test/cs_e2e_${orderId}` });
    expect((await buyer.get(`${base}/orders/${orderId}`).expect(200)).body.order).toMatchObject({ status: "pending", amount: 4900 });

    await paidWebhook(orderId).expect(200);
    await paidWebhook(orderId).expect(200);

    expect((await buyer.get(`${base}/orders/${orderId}`).expect(200)).body.order.status).toBe("paid");
    const again = await buyer.post(`${base}/checkout`).send({ courseSlug: course.slug, method: "stripe" }).expect(409);
    expect(again.body.type).toBe("urn:reanit:problem:already-enrolled");
  });

  it("enrolls a PayWay buyer once the gateway reports the payment, when the order is read", async () => {
    const base = `/schools/by-subdomain/${alpha.school.subdomain}`;
    const { agent: buyer } = await signUp(e2e().app, uniqueName("buyer-aba"));
    const checkout = await buyer.post(`${base}/checkout`).send({ courseSlug: course.slug, method: "aba_payway" }).expect(201);
    const { orderId } = checkout.body;
    expect(checkout.body.payment).toEqual({ kind: "form", action: "https://payway.test/purchase", fields: { tran_id: `pw_${orderId}` } });

    expect((await buyer.get(`${base}/orders/${orderId}`).expect(200)).body.order.status).toBe("pending");
    e2e().paidAtGateway.add(`pw_${orderId}`);
    expect((await buyer.get(`${base}/orders/${orderId}`).expect(200)).body.order.status).toBe("paid");

    await buyer.post(`${base}/checkout`).send({ courseSlug: course.slug, method: "aba_payway" }).expect(409);
  });

  it("refuses a method that is not configured", async () => {
    const { agent: buyer } = await signUp(e2e().app, uniqueName("buyer-khqr"));

    const response = await buyer
      .post(`/schools/by-subdomain/${alpha.school.subdomain}/checkout`)
      .send({ courseSlug: course.slug, method: "bakong_khqr" })
      .expect(400);

    expect(response.body.type).toBe("urn:reanit:problem:payment-method-unavailable");
  });

  it("hides an order from other users and a course's price from other schools", async () => {
    const base = `/schools/by-subdomain/${alpha.school.subdomain}`;
    const { agent: buyer } = await signUp(e2e().app, uniqueName("buyer-private"));
    const { orderId } = (await buyer.post(`${base}/checkout`).send({ courseSlug: course.slug, method: "stripe" }).expect(201)).body;
    const { agent: stranger } = await signUp(e2e().app, uniqueName("stranger"));
    const beta = await openSchool(e2e().app, uniqueName("shop-beta"));

    await stranger.get(`${base}/orders/${orderId}`).expect(404);
    await beta.agent.put(`/courses/${course.id}/price`).send({ amount: 1, currency: "USD" }).expect(404);
  });

  it("ignores a forged webhook", async () => {
    const payload = JSON.stringify({ id: "evt_forged", object: "event", type: "checkout.session.completed", data: { object: { id: "cs_x" } } });

    await request(e2e().app.getHttpServer())
      .post("/webhooks/stripe")
      .set("content-type", "application/json")
      .set("stripe-signature", "t=1,v1=forged")
      .send(payload)
      .expect(400);
  });
});

describe("coupons", () => {
  const coupon = { code: "launch", kind: "percent", percentOff: 20, maxRedemptions: 1 };
  let couponId: string;

  it("creates a coupon once and prices a course with it", async () => {
    couponId = (await alpha.agent.post("/coupons").send({ coupon }).expect(201)).body.coupon.id;
    await alpha.agent.post("/coupons").send({ coupon }).expect(409);

    const offer = await request(e2e().app.getHttpServer()).get(`/schools/by-subdomain/${alpha.school.subdomain}/courses/${course.slug}/offer?coupon=LAUNCH`).expect(200);
    expect(offer.body.discount).toEqual({ code: "LAUNCH", amountOff: 980, total: 3920 });
  });

  it("charges the discounted price and counts only paid uses towards the limit", async () => {
    const base = `/schools/by-subdomain/${alpha.school.subdomain}`;
    const { agent: buyer } = await signUp(e2e().app, uniqueName("buyer-coupon"));
    const { orderId } = (await buyer.post(`${base}/checkout`).send({ courseSlug: course.slug, method: "stripe", couponCode: "launch" }).expect(201)).body;
    expect((await buyer.get(`${base}/orders/${orderId}`).expect(200)).body.order.amount).toBe(3920);
    await paidWebhook(orderId).expect(200);

    expect((await alpha.agent.get("/coupons").expect(200)).body.coupons).toEqual([
      { id: couponId, code: "LAUNCH", kind: "percent", percentOff: 20, expiresAt: null, maxRedemptions: 1, redemptions: 1 },
    ]);
    const { agent: late } = await signUp(e2e().app, uniqueName("buyer-late"));
    const refused = await late.post(`${base}/checkout`).send({ courseSlug: course.slug, method: "stripe", couponCode: "LAUNCH" }).expect(400);
    expect(refused.body.type).toBe("urn:reanit:problem:invalid-coupon");
  });

  it("keeps a coupon inside its school and audits its creation and deletion", async () => {
    const beta = await openSchool(e2e().app, uniqueName("shop-coupon"));

    await beta.agent.delete(`/coupons/${couponId}`).expect(404);
    await alpha.agent.delete(`/coupons/${couponId}`).expect(204);

    expect((await alpha.agent.get("/audit-events").expect(200)).body.entries.map(({ action }: { action: string }) => action)).toEqual(
      expect.arrayContaining(["coupon.create", "coupon.delete"]),
    );
  });
});

describe("bundles", () => {
  it("sells a published bundle at one price and enrolls the buyer in every course once Stripe confirms", async () => {
    const base = `/schools/by-subdomain/${alpha.school.subdomain}`;
    const second = (await alpha.agent.post("/courses").send({ title: "Bundle Extra" }).expect(201)).body.course;
    await alpha.agent.patch(`/courses/${second.id}`).send({ status: "published" }).expect(200);
    await alpha.agent.put(`/courses/${second.id}/price`).send({ amount: 3900, currency: "USD" }).expect(200);
    const { bundle } = (await alpha.agent.post("/bundles").send({ title: "Starter Kit", courseIds: [course.id, second.id] }).expect(201)).body;
    const anonymous = request(e2e().app.getHttpServer());
    await anonymous.get(`${base}/bundles/${bundle.slug}`).expect(404);

    await alpha.agent.patch(`/bundles/${bundle.id}`).send({ status: "published" }).expect(200);
    await alpha.agent.put(`/bundles/${bundle.id}/price`).send({ amount: 7001, currency: "USD" }).expect(200);
    expect((await anonymous.get(`${base}/bundles/${bundle.slug}`).expect(200)).body.bundle).toMatchObject({
      title: "Starter Kit",
      courses: [{ id: course.id }, { id: second.id }],
      price: { amount: 7001, currency: "USD" },
    });

    const { agent: buyer } = await signUp(e2e().app, uniqueName("buyer-bundle"));
    const { orderId } = (await buyer.post(`${base}/bundle-checkout`).send({ bundleSlug: bundle.slug, method: "stripe" }).expect(201)).body;
    expect((await buyer.get(`${base}/orders/${orderId}`).expect(200)).body.order.amount).toBe(7001);
    await paidWebhook(orderId).expect(200);

    const again = await buyer.post(`${base}/bundle-checkout`).send({ bundleSlug: bundle.slug, method: "stripe" }).expect(409);
    expect(again.body.type).toBe("urn:reanit:problem:already-enrolled");
    await buyer.post(`${base}/checkout`).send({ courseSlug: second.slug, method: "stripe" }).expect(409);
  });

  it("refuses another school's course in a bundle", async () => {
    const beta = await openSchool(e2e().app, uniqueName("bundle-beta"));
    const theirs = (await beta.agent.post("/courses").send({ title: "Theirs" }).expect(201)).body.course;

    const response = await alpha.agent.post("/bundles").send({ title: "Mixed", courseIds: [course.id, theirs.id] }).expect(400);

    expect(response.body.type).toBe("urn:reanit:problem:unknown-bundle-course");
  });
});
