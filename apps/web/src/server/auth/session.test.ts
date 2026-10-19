// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { authService, SESSION } from "@/test/auth-service";
import { cookieJar } from "@/test/headers";
import { RedirectError } from "@/test/navigation";

import {
  endSession,
  getCurrentUser,
  redirectIfSignedIn,
  requireUser,
  SESSION_COOKIE,
  setSessionCookie,
} from "./session";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("./service", () => import("@/test/auth-service"));

describe("session cookie", () => {
  it("stores the token in an HTTP-only cookie that expires with the session", async () => {
    await setSessionCookie(SESSION);

    expect(cookieJar.inspect(SESSION_COOKIE)).toEqual({
      value: SESSION.token,
      options: expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", expires: SESSION.expiresAt }),
    });
  });

  it("returns the cookie's user", async () => {
    cookieJar.set(SESSION_COOKIE, SESSION.token);
    authService.getSessionUser.mockResolvedValue(SESSION.user);

    expect(await getCurrentUser()).toEqual(SESSION.user);
    expect(authService.getSessionUser).toHaveBeenCalledWith(SESSION.token);
  });

  it("returns null without asking the service when there is no cookie", async () => {
    expect(await getCurrentUser()).toBeNull();
    expect(authService.getSessionUser).not.toHaveBeenCalled();
  });

  it("deletes the session and its cookie on sign-out", async () => {
    cookieJar.set(SESSION_COOKIE, SESSION.token);

    await endSession();

    expect(authService.logOut).toHaveBeenCalledWith(SESSION.token);
    expect(cookieJar.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("skips the service when signing out without a cookie", async () => {
    await endSession();

    expect(authService.logOut).not.toHaveBeenCalled();
  });
});

describe("redirectIfSignedIn", () => {
  it("redirects a signed-in visitor to next", async () => {
    cookieJar.set(SESSION_COOKIE, SESSION.token);
    authService.getSessionUser.mockResolvedValue(SESSION.user);

    await expect(redirectIfSignedIn("/dashboard")).rejects.toEqual(new RedirectError("/dashboard"));
  });

  it("redirects home when next is off-site", async () => {
    cookieJar.set(SESSION_COOKIE, SESSION.token);
    authService.getSessionUser.mockResolvedValue(SESSION.user);

    await expect(redirectIfSignedIn("https://evil.example")).rejects.toEqual(new RedirectError("/"));
  });

  it("lets a signed-out visitor stay", async () => {
    await expect(redirectIfSignedIn("/dashboard")).resolves.toBeUndefined();
  });
});

describe("requireUser", () => {
  it("returns the signed-in user", async () => {
    cookieJar.set(SESSION_COOKIE, SESSION.token);
    authService.getSessionUser.mockResolvedValue(SESSION.user);

    expect(await requireUser("/onboarding")).toEqual(SESSION.user);
  });

  it("sends a signed-out visitor to log in and back", async () => {
    await expect(requireUser("/onboarding?step=2")).rejects.toEqual(new RedirectError("/login?next=%2Fonboarding%3Fstep%3D2"));
  });
});
