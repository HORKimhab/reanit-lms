import { describe, expect, it } from "vitest";

import { sessionCookieOptions } from "./session-cookie";

describe("sessionCookieOptions", () => {
  it("is HttpOnly, SameSite=Lax and site-wide", () => {
    expect(sessionCookieOptions("http://localhost:3000")).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("is Secure only when the app is served over HTTPS", () => {
    expect(sessionCookieOptions("https://reanit.com").secure).toBe(true);
    expect(sessionCookieOptions("http://localhost:3000").secure).toBe(false);
  });

  it("expires with the session", () => {
    const expiresAt = new Date("2026-11-18T00:00:00Z");

    expect(sessionCookieOptions("https://reanit.com", expiresAt).expires).toEqual(expiresAt);
  });
});
