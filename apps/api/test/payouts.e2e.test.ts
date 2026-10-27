import { describe, expect, it } from "vitest";

import { buyCourse, openSchool, signInAsPlatformAdmin, signUp, uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp();

describe("payouts", () => {
  it("holds a new sale, takes the owner's payout details, and lets only a platform admin record a payout within the balance", async () => {
    const { agent: owner, school } = await openSchool(e2e().app, uniqueName("payouts-school"), "pro");
    const { course } = (await owner.post("/courses").send({ title: "Payout Course" }).expect(201)).body;
    await owner.patch(`/courses/${course.id}`).send({ status: "published" }).expect(200);
    await owner.put(`/courses/${course.id}/price`).send({ amount: 4900, currency: "USD" }).expect(200);
    const { agent: buyer } = await signUp(e2e().app, uniqueName("payouts-buyer"));
    await buyCourse(e2e(), buyer, school.subdomain, course.slug);

    expect((await owner.get("/schools/current/payouts").expect(200)).body).toMatchObject({ balances: [{ currency: "USD", available: 0, onHold: 4655 }], account: null, payouts: [] });
    await owner.put("/schools/current/payout-account").send({ holderName: "Sokha Chan", bankName: "ABA Bank", account: "000 123 456" }).expect(200);
    expect((await owner.get("/schools/current/payouts").expect(200)).body.account).toEqual({ holderName: "Sokha Chan", bankName: "ABA Bank", account: "000 123 456" });

    await owner.get("/admin/payouts/due").expect(403);
    const admin = await signInAsPlatformAdmin(e2e().app);
    expect((await admin.get("/admin/payouts/due").expect(200)).body.payouts.some(({ school: due }: { school: { id: string } }) => due.id === school.id)).toBe(false);
    const refused = await admin.post("/admin/payouts").send({ schoolId: school.id, currency: "USD", amount: 100, paidAt: "2026-11-01T02:00:00Z", reference: "ABA-TRX-1" }).expect(409);
    expect(refused.body.type).toBe("urn:reanit:problem:payout-exceeds-balance");
  });
});
