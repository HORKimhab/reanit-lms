import { describe, expect, it } from "vitest";

import { openSchool, payForPlan, uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp();

describe("creator plans", () => {
  it("holds a Free school to Free's limits, and lifts them once it pays for Pro", async () => {
    const { agent: owner } = await openSchool(e2e().app, uniqueName("plan-free"), "free");
    expect((await owner.get("/schools/current/plan").expect(200)).body).toMatchObject({ plan: "free", paid: null });

    const courses = [];
    for (const title of ["One", "Two", "Three", "Four"]) courses.push((await owner.post("/courses").send({ title }).expect(201)).body.course);
    for (const course of courses.slice(0, 3)) await owner.patch(`/courses/${course.id}`).send({ status: "published" }).expect(200);
    const refused = await owner.patch(`/courses/${courses[3].id}`).send({ status: "published" }).expect(403);
    expect(refused.body.type).toBe("urn:reanit:problem:plan-limit");
    await owner.post("/team/invites").send({ email: `${uniqueName("plan-invitee")}@example.com`, role: "instructor" }).expect(403);

    await payForPlan(owner, "pro");

    expect((await owner.get("/schools/current/plan").expect(200)).body).toMatchObject({ plan: "pro", paid: { plan: "pro", interval: "year" } });
    await owner.patch(`/courses/${courses[3].id}`).send({ status: "published" }).expect(200);
    await owner.post("/team/invites").send({ email: `${uniqueName("plan-invitee")}@example.com`, role: "instructor" }).expect(201);
  });
});
