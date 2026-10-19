// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { authService, SESSION } from "@/test/auth-service";
import { cookieJar } from "@/test/headers";

import { endSession, getCurrentUser, SESSION_COOKIE, setSessionCookie } from "./session";

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
