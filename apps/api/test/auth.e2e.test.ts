import { SESSION_COOKIE } from "@reanit/core/auth";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { signUp, uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp();

/**
 * Starts a request from a signed-out client.
 *
 * @returns A supertest client for the app.
 */
function anonymous() {
  return request(e2e().app.getHttpServer());
}

describe("auth", () => {
  it("signs up, reads the user back from the session and signs out", async () => {
    const name = uniqueName("auth-flow");
    const { agent, email } = await signUp(e2e().app, name);

    const me = await agent.get("/auth/me").expect(200);
    expect(me.body.user).toMatchObject({ email, name });

    await agent.post("/auth/logout").expect(204);
    await agent.get("/auth/me").expect(401);
  });

  it("answers 409 for an email that already has an account", async () => {
    const name = uniqueName("auth-taken");
    await signUp(e2e().app, name);

    const response = await anonymous()
      .post("/auth/sign-up")
      .send({ name, email: `${name.toUpperCase()}@Example.com`, password: "correct horse battery" })
      .expect(409);

    expect(response.body.type).toBe("urn:reanit:problem:email-taken");
  });

  it("logs in with the right password and refuses a wrong one with 401", async () => {
    const { email } = await signUp(e2e().app, uniqueName("auth-login"));

    const login = await anonymous().post("/auth/login").send({ email, password: "correct horse battery" }).expect(200);
    expect(login.headers["set-cookie"]?.[0]).toContain(`${SESSION_COOKIE}=`);

    const wrong = await anonymous().post("/auth/login").send({ email, password: "wrong password" }).expect(401);
    expect(wrong.body.type).toBe("urn:reanit:problem:invalid-credentials");
  });

  it("signs in once from an emailed magic link, creating the account", async () => {
    const email = `${uniqueName("auth-magic")}@example.com`;
    await anonymous().post("/auth/magic-link").send({ email, next: "/courses" }).expect(202);
    const sent = e2e().mail.find((message) => message.to === email);
    const link = new URL(sent?.text.match(/https?:\/\/\S+/)?.[0] ?? "");
    const verifyPath = `${link.pathname.replace(/^\/api/, "")}${link.search}`;
    const agent = request.agent(e2e().app.getHttpServer());

    await agent.get(verifyPath).expect(303).expect("location", "/courses");
    const me = await agent.get("/auth/me").expect(200);
    expect(me.body.user).toMatchObject({ email, name: null });

    await anonymous().get(verifyPath).expect(303).expect("location", "/login?error=invalid-link");
  });

  it("answers 401 to a signed-out caller and to a forged session", async () => {
    await anonymous().get("/auth/me").expect(401);
    await anonymous().get("/auth/me").set("cookie", `${SESSION_COOKIE}=forged`).expect(401);
  });
});
