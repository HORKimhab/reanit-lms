import { describe, expect, it } from "vitest";

import { openSchool, uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp();

describe("audit log", () => {
  it("lists what the owner did, newest first, with who did it, and shows another school nothing", async () => {
    const name = uniqueName("audited");
    const { agent, school } = await openSchool(e2e().app, name);
    const rival = await openSchool(e2e().app, uniqueName("audit-rival"));

    const { course } = (await agent.post("/courses").send({ title: "Audited" }).expect(201)).body;
    await agent.patch(`/courses/${course.id}`).send({ title: "Audited again" }).expect(200);
    await agent.patch("/schools/current").send({ name: "Renamed", brandColor: "#0055aa" }).expect(200);
    await agent.patch(`/courses/${crypto.randomUUID()}`).send({ title: "Missing" }).expect(404);

    const log = (await agent.get("/audit-events").expect(200)).body;

    expect(log.total).toBe(3);
    expect(log.entries.map(({ action, targetId }: { action: string; targetId: string }) => ({ action, targetId }))).toEqual([
      { action: "school.settings.update", targetId: school.id },
      { action: "course.update", targetId: course.id },
      { action: "course.create", targetId: course.id },
    ]);
    expect(log.entries[0].actor).toMatchObject({ email: `${name}@example.com`, name });
    expect((await rival.agent.get("/audit-events").expect(200)).body).toMatchObject({ total: 0, entries: [] });
  });
});
