import request from "supertest";
import { describe, expect, it } from "vitest";

import { openSchool, signUp, uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp();

describe("account", () => {
  it("exports a student's data, then deletes the account so its email can sign up again", async () => {
    const name = uniqueName("gdpr");
    const { agent, email } = await signUp(e2e().app, name);

    const exported = await agent.get("/me/data-export").expect(200);
    expect(exported.body.account).toMatchObject({ email, name });
    expect(exported.headers["content-disposition"]).toMatch(/^attachment; filename="reanit-data-\d{4}-\d{2}-\d{2}\.json"$/);

    await agent.delete("/me").send({ confirmEmail: "someone@example.com" }).expect(400);
    await agent.delete("/me").send({ confirmEmail: email }).expect(204);

    await agent.get("/auth/me").expect(401);
    await request(e2e().app.getHttpServer()).post("/auth/login").send({ email, password: "correct horse battery" }).expect(401);
    await signUp(e2e().app, name);
  });

  it("refuses to delete the account of a school's owner", async () => {
    const { agent } = await openSchool(e2e().app, uniqueName("gdpr-owner"));
    const { email } = (await agent.get("/auth/me").expect(200)).body.user;

    const response = await agent.delete("/me").send({ confirmEmail: email }).expect(409);

    expect(response.body.type).toBe("urn:reanit:problem:account-runs-school");
  });
});
