import { describe, expect, it } from "vitest";

import { openSchool, signInAsPlatformAdmin, uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp();

describe("platform admin console", () => {
  it("lets an owner pay for a plan by the platform's QR, and only a platform admin confirm it", async () => {
    const { agent: owner, school } = await openSchool(e2e().app, uniqueName("qr-plan"), "free");
    const { paymentId, payment } = (await owner.post("/schools/current/plan/checkout").send({ plan: "pro", interval: "month", method: "offline_qr" }).expect(201)).body;
    expect(payment).toEqual({ kind: "offline", qrImageUrl: "https://cdn.reanit.test/platform-qr.png" });
    await owner.post(`/schools/current/plan/payments/${paymentId}/offline-payment`).send({ reference: "ABA-QR-1" }).expect(204);

    await owner.get("/admin/plan-payments").expect(403);
    const admin = await signInAsPlatformAdmin(e2e().app);
    const { payments } = (await admin.get("/admin/plan-payments").expect(200)).body;
    expect(payments).toContainEqual(expect.objectContaining({ id: paymentId, reference: "ABA-QR-1", school: expect.objectContaining({ id: school.id }) }));
    await admin.post(`/admin/plan-payments/${paymentId}/confirm`).expect(200);

    expect((await owner.get("/schools/current/plan").expect(200)).body).toMatchObject({ plan: "pro", paid: { plan: "pro", interval: "month" } });
    expect((await admin.post(`/admin/plan-payments/${paymentId}/reject`).expect(409)).body.type).toBe("urn:reanit:problem:plan-payment-closed");
  });

  it("takes a school's site offline and back, and lists it with its suspension", async () => {
    const { school } = await openSchool(e2e().app, uniqueName("suspended"), "free");
    const admin = await signInAsPlatformAdmin(e2e().app);

    await admin.put(`/admin/schools/${school.id}/suspension`).send({ reason: "Pirated courses" }).expect(200);

    await admin.get(`/schools/by-subdomain/${school.subdomain}`).expect(404);
    const { schools } = (await admin.get("/admin/schools").query({ q: school.subdomain }).expect(200)).body;
    expect(schools).toEqual([expect.objectContaining({ id: school.id, plan: "free", suspension: expect.objectContaining({ reason: "Pirated courses" }) })]);

    await admin.delete(`/admin/schools/${school.id}/suspension`).expect(200);
    await admin.get(`/schools/by-subdomain/${school.subdomain}`).expect(200);
  });
});
