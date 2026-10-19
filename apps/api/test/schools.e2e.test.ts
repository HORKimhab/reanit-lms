import request from "supertest";
import { describe, expect, it } from "vitest";

import { openSchool, signUp, uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp();

describe("schools", () => {
  it("opens a school its creator then runs as owner", async () => {
    const name = uniqueName("school-open");
    const { agent, school } = await openSchool(e2e().app, name);

    expect(school).toMatchObject({ name, subdomain: name });
    const current = await agent.get("/schools/current").expect(200);
    expect(current.body).toEqual({ school, role: "owner" });
  });

  it("finds a school by subdomain for anyone, and 404s for an unknown one", async () => {
    const { school } = await openSchool(e2e().app, uniqueName("school-find"));
    const anonymous = request(e2e().app.getHttpServer());

    const found = await anonymous.get(`/schools/by-subdomain/${school.subdomain}`).expect(200);
    expect(found.body).toEqual({ school, owner: { name: school.name } });

    const missing = await anonymous.get(`/schools/by-subdomain/${uniqueName("missing")}`).expect(404);
    expect(missing.body.type).toBe("urn:reanit:problem:school-not-found");
  });

  it("answers 409 when another school has the subdomain", async () => {
    const { school } = await openSchool(e2e().app, uniqueName("school-taken"));
    const { agent } = await signUp(e2e().app, uniqueName("school-rival"));

    const response = await agent.post("/schools").send({ name: "Rival", subdomain: school.subdomain }).expect(409);

    expect(response.body.type).toBe("urn:reanit:problem:subdomain-taken");
  });

  it("answers 403 to a signed-in user who runs no school", async () => {
    const { agent } = await signUp(e2e().app, uniqueName("school-none"));

    const response = await agent.get("/schools/current").expect(403);

    expect(response.body.type).toBe("urn:reanit:problem:not-school-staff");
  });

  it("answers 401 when a signed-out caller opens a school", async () => {
    await request(e2e().app.getHttpServer()).post("/schools").send({ name: "Nobody", subdomain: uniqueName("nobody") }).expect(401);
  });

  it("saves its owner's settings and logo, which its public site then shows", async () => {
    const { agent, school } = await openSchool(e2e().app, uniqueName("school-brand"));
    const { key } = (await agent.post("/schools/current/logo-uploads").send({ contentType: "image/png", sizeBytes: 2048 }).expect(201)).body;
    expect(key).toMatch(new RegExp(`^schools/${school.id}/logo/[0-9a-f-]+\\.png$`));

    await agent.patch("/schools/current").send({ name: "Brand Co", brandColor: "#0055AA", logoKey: key }).expect(409);
    e2e().storage.uploaded.add(key);
    const saved = await agent.patch("/schools/current").send({ name: "Brand Co", brandColor: "#0055AA", logoKey: key }).expect(200);

    const expected = { ...school, name: "Brand Co", brandColor: "#0055aa", logoUrl: `https://storage.test/${key}?signed` };
    expect(saved.body.school).toEqual(expected);
    expect((await request(e2e().app.getHttpServer()).get(`/schools/by-subdomain/${school.subdomain}`).expect(200)).body.school).toEqual(expected);
  });

  it("refuses another school's logo, and changes only the caller's own school", async () => {
    const alpha = await openSchool(e2e().app, uniqueName("school-alpha"));
    const beta = await openSchool(e2e().app, uniqueName("school-beta"));
    const alphaLogo = `schools/${alpha.school.id}/logo/forged.png`;
    e2e().storage.uploaded.add(alphaLogo);

    const response = await beta.agent.patch("/schools/current").send({ name: "Beta", brandColor: null, logoKey: alphaLogo }).expect(400);
    expect(response.body.type).toBe("urn:reanit:problem:invalid-media-key");

    await beta.agent.patch("/schools/current").send({ name: "Renamed Beta", brandColor: null }).expect(200);
    expect((await alpha.agent.get("/schools/current").expect(200)).body.school.name).toBe(alpha.school.name);
  });
});

