import {
  EmailTakenError,
  InvalidCredentialsError,
  InvalidMagicLinkError,
  SESSION_COOKIE,
  type AuthSession,
} from "@reanit/core/auth";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";

import { useTestApp } from "../test/app";
import { INVALID_MAGIC_LINK_PATH } from "./auth.controller";

const SESSION: AuthSession = {
  user: { id: "9f1c2a4e-3b5d-4c6e-8f70-1a2b3c4d5e6f", email: "dara@example.com", name: "Dara" },
  token: "session-token",
  expiresAt: new Date("2026-11-18T00:00:00Z"),
};
const SIGN_UP = { name: "Dara", email: "Dara@Example.com", password: "correct horse battery" };
const SESSION_HEADER = { cookie: `${SESSION_COOKIE}=${SESSION.token}` };

const testApp = useTestApp();

/**
 * Finds the session cookie a response sets.
 *
 * @param response The response.
 * @returns The cookie, or undefined when none was set.
 */
function sessionCookieOf(response: LightMyRequestResponse) {
  return response.cookies.find((cookie) => cookie.name === SESSION_COOKIE);
}

describe("POST /auth/sign-up", () => {
  it("creates the account with the parsed body and sets the session cookie", async () => {
    testApp.clients.auth.signUp.mockResolvedValue(SESSION);

    const response = await testApp.app.inject({ method: "POST", url: "/auth/sign-up", payload: SIGN_UP });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ user: SESSION.user });
    expect(testApp.clients.auth.signUp).toHaveBeenCalledWith({ ...SIGN_UP, email: "dara@example.com" });
    expect(sessionCookieOf(response)).toMatchObject({
      value: SESSION.token,
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      expires: SESSION.expiresAt,
    });
  });

  it("answers 409 without a cookie when the email is taken", async () => {
    testApp.clients.auth.signUp.mockRejectedValue(new EmailTakenError());

    const response = await testApp.app.inject({ method: "POST", url: "/auth/sign-up", payload: SIGN_UP });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ type: "urn:reanit:problem:email-taken" });
    expect(sessionCookieOf(response)).toBeUndefined();
  });

  it("answers 400 and creates nothing when the body is invalid", async () => {
    const response = await testApp.app.inject({ method: "POST", url: "/auth/sign-up", payload: { ...SIGN_UP, password: "short" } });

    expect(response.statusCode).toBe(400);
    expect(testApp.clients.auth.signUp).not.toHaveBeenCalled();
  });
});

describe("POST /auth/login", () => {
  it("signs in and sets the session cookie", async () => {
    testApp.clients.auth.logIn.mockResolvedValue(SESSION);

    const response = await testApp.app.inject({ method: "POST", url: "/auth/login", payload: { email: SIGN_UP.email, password: "x" } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ user: SESSION.user });
    expect(sessionCookieOf(response)?.value).toBe(SESSION.token);
  });

  it("answers 401 when the credentials are wrong", async () => {
    testApp.clients.auth.logIn.mockRejectedValue(new InvalidCredentialsError());

    const response = await testApp.app.inject({ method: "POST", url: "/auth/login", payload: { email: SIGN_UP.email, password: "x" } });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ type: "urn:reanit:problem:invalid-credentials" });
  });
});

describe("POST /auth/magic-link", () => {
  /**
   * Requests a link and returns the email the service was asked to compose for a token.
   *
   * @param payload Request body.
   * @returns The response and the composed email for the token `tok`.
   */
  async function requestLink(payload: object) {
    const response = await testApp.app.inject({ method: "POST", url: "/auth/magic-link", payload });
    const compose = testApp.clients.auth.requestMagicLink.mock.calls[0]?.[1] as
      | ((token: string) => Promise<{ subject: string; text: string; html?: string }>)
      | undefined;
    return { response, email: await compose?.("tok") };
  }

  it("answers 202 and emails a link that returns to next", async () => {
    const { response, email } = await requestLink({ email: SIGN_UP.email, next: "/courses" });

    expect(response.statusCode).toBe(202);
    expect(testApp.clients.auth.requestMagicLink).toHaveBeenCalledWith("dara@example.com", expect.any(Function));
    expect(email?.text).toContain("http://localhost:3000/api/auth/magic-link/verify?token=tok&next=%2Fcourses");
  });

  it("links home when next points off-site", async () => {
    const { email } = await requestLink({ email: SIGN_UP.email, next: "//evil.example" });

    expect(email?.html).toContain('next=%2F"');
  });

  it("writes the email in the requested language", async () => {
    const { email } = await requestLink({ email: SIGN_UP.email, locale: "km" });

    expect(email?.subject).toBe("តំណចូលគណនីរបស់អ្នក");
  });

  it("answers 400 for a malformed email", async () => {
    const { response } = await requestLink({ email: "not-an-email" });

    expect(response.statusCode).toBe(400);
    expect(testApp.clients.auth.requestMagicLink).not.toHaveBeenCalled();
  });
});

describe("GET /auth/magic-link/verify", () => {
  it("signs in and redirects to next", async () => {
    testApp.clients.auth.verifyMagicLink.mockResolvedValue(SESSION);

    const response = await testApp.app.inject({ method: "GET", url: "/auth/magic-link/verify?token=tok&next=%2Fcourses" });

    expect(testApp.clients.auth.verifyMagicLink).toHaveBeenCalledWith("tok");
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("/courses");
    expect(sessionCookieOf(response)?.value).toBe(SESSION.token);
  });

  it("redirects home when next points off-site", async () => {
    testApp.clients.auth.verifyMagicLink.mockResolvedValue(SESSION);

    const response = await testApp.app.inject({ method: "GET", url: "/auth/magic-link/verify?token=tok&next=https%3A%2F%2Fevil.example" });

    expect(response.headers.location).toBe("/");
  });

  it("redirects to the login error without a cookie when the link is invalid", async () => {
    testApp.clients.auth.verifyMagicLink.mockRejectedValue(new InvalidMagicLinkError());

    const response = await testApp.app.inject({ method: "GET", url: "/auth/magic-link/verify?token=used" });

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe(INVALID_MAGIC_LINK_PATH);
    expect(sessionCookieOf(response)).toBeUndefined();
  });

  it("redirects to the login error when the token is missing", async () => {
    const response = await testApp.app.inject({ method: "GET", url: "/auth/magic-link/verify" });

    expect(response.headers.location).toBe(INVALID_MAGIC_LINK_PATH);
    expect(testApp.clients.auth.verifyMagicLink).not.toHaveBeenCalled();
  });

  it("answers 500 problem+json for an unexpected failure", async () => {
    testApp.clients.auth.verifyMagicLink.mockRejectedValue(new Error("database down"));

    const response = await testApp.app.inject({ method: "GET", url: "/auth/magic-link/verify?token=tok" });

    expect(response.statusCode).toBe(500);
  });
});

describe("POST /auth/logout", () => {
  it("ends the session and clears the cookie", async () => {
    const response = await testApp.app.inject({ method: "POST", url: "/auth/logout", headers: SESSION_HEADER });

    expect(response.statusCode).toBe(204);
    expect(testApp.clients.auth.logOut).toHaveBeenCalledWith(SESSION.token);
    expect(sessionCookieOf(response)).toMatchObject({ value: "", expires: new Date(0) });
  });

  it("answers 204 when nobody is signed in", async () => {
    const response = await testApp.app.inject({ method: "POST", url: "/auth/logout" });

    expect(response.statusCode).toBe(204);
    expect(testApp.clients.auth.logOut).not.toHaveBeenCalled();
  });
});

describe("GET /auth/me", () => {
  it("returns the user of a valid session", async () => {
    testApp.clients.auth.getSessionUser.mockResolvedValue(SESSION.user);

    const response = await testApp.app.inject({ method: "GET", url: "/auth/me", headers: SESSION_HEADER });

    expect(testApp.clients.auth.getSessionUser).toHaveBeenCalledWith(SESSION.token);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ user: SESSION.user });
  });

  it("answers 401 problem+json without a session cookie", async () => {
    const response = await testApp.app.inject({ method: "GET", url: "/auth/me" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ status: 401, title: "Unauthorized" });
  });

  it("answers 401 when the session is unknown or expired", async () => {
    const response = await testApp.app.inject({ method: "GET", url: "/auth/me", headers: SESSION_HEADER });

    expect(response.statusCode).toBe(401);
  });
});

describe("public routes", () => {
  it("serve signed-out callers", async () => {
    const response = await testApp.app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
  });
});
