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

    expect((await anonymous.get(`${base}/courses/${course.slug}/offer`).expect(200)).body).toEqual({ price: null, methods: [] });
    await alpha.agent.put(`/courses/${course.id}/price`).send({ amount: 4900, currency: "USD" }).expect(200);
    expect((await anonymous.get(`${base}/courses/${course.slug}/offer`).expect(200)).body).toEqual({
      price: { amount: 4900, currency: "USD" },
      methods: ["aba_payway", "stripe"],
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
