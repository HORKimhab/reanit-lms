// @vitest-environment node
import { SESSION_COOKIE } from "@reanit/core/auth";
import { describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo, SESSION_TOKEN, sessionStarted, TEST_USER } from "@/test/api";
import { cookieJar } from "@/test/headers";
import { RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { endSession, getCurrentUser, redirectIfSignedIn, relaySessionCookie, requireUser } from "./session";

vi.mock("next/headers", () => import("@/test/headers"));

describe("relaySessionCookie", () => {
  it("passes the API's session cookie on to the browser", async () => {
    await relaySessionCookie(sessionStarted(201));

    expect(cookieJar.inspect(SESSION_COOKIE)).toEqual({
      value: SESSION_TOKEN,
      options: expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    });
  });

  it("ignores other cookies", async () => {
    await relaySessionCookie(new Response(null, { headers: { "set-cookie": "tracking=1; Path=/" } }));

    expect(cookieJar.get("tracking")).toBeUndefined();
  });
});

describe("getCurrentUser", () => {
  it("asks the API for the cookie's user, forwarding the cookie", async () => {
    signIn();

    expect(await getCurrentUser()).toEqual(TEST_USER);
    expect(requestTo("GET /auth/me")?.headers.get("cookie")).toBe(`${SESSION_COOKIE}=${SESSION_TOKEN}`);
  });

  it("returns null without calling the API when there is no cookie", async () => {
    expect(await getCurrentUser()).toBeNull();
    expect(requestTo("GET /auth/me")).toBeUndefined();
  });

  it("returns null when the API no longer knows the session", async () => {
    cookieJar.set(SESSION_COOKIE, SESSION_TOKEN);
    onApi("GET /auth/me", problem(401));

    expect(await getCurrentUser()).toBeNull();
  });

  it("throws when the API fails", async () => {
    cookieJar.set(SESSION_COOKIE, SESSION_TOKEN);
    onApi("GET /auth/me", problem(500));

    await expect(getCurrentUser()).rejects.toThrow("API answered 500");
  });
});

describe("endSession", () => {
  it("ends the session with the API and deletes the cookie", async () => {
    cookieJar.set(SESSION_COOKIE, SESSION_TOKEN);
    onApi("POST /auth/logout", new Response(null, { status: 204 }));

    await endSession();

    expect(requestTo("POST /auth/logout")).toBeDefined();
    expect(cookieJar.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("skips the API when signing out without a cookie", async () => {
    await endSession();

    expect(requestTo("POST /auth/logout")).toBeUndefined();
  });
});

describe("redirectIfSignedIn", () => {
  it("redirects a signed-in visitor to next", async () => {
    signIn();

    await expect(redirectIfSignedIn("/dashboard")).rejects.toEqual(new RedirectError("/dashboard"));
  });

  it("redirects home when next is off-site", async () => {
    signIn();

    await expect(redirectIfSignedIn("https://evil.example")).rejects.toEqual(new RedirectError("/"));
  });

  it("lets a signed-out visitor stay", async () => {
    await expect(redirectIfSignedIn("/dashboard")).resolves.toBeUndefined();
  });
});

describe("requireUser", () => {
  it("returns the signed-in user", async () => {
    signIn();

    expect(await requireUser("/onboarding")).toEqual(TEST_USER);
  });

  it("sends a signed-out visitor to log in and back", async () => {
    await expect(requireUser("/onboarding?step=2")).rejects.toEqual(new RedirectError("/login?next=%2Fonboarding%3Fstep%3D2"));
  });
});
