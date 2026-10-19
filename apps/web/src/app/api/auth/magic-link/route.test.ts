// @vitest-environment node
import { InvalidMagicLinkError } from "@reanit/core/auth";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE } from "@/server/auth/session";
import { authService, SESSION } from "@/test/auth-service";
import { cookieJar } from "@/test/headers";
import { RedirectError } from "@/test/navigation";

import { GET } from "./route";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("@/server/auth/service", () => import("@/test/auth-service"));

/**
 * Builds the request a clicked magic link makes.
 *
 * @param query Query string, without `?`.
 * @returns The request.
 */
function linkRequest(query: string) {
  return new NextRequest(`http://localhost:3000/api/auth/magic-link?${query}`);
}

describe("GET /api/auth/magic-link", () => {
  it("signs in and redirects to the link's next path", async () => {
    authService.verifyMagicLink.mockResolvedValue(SESSION);

    await expect(GET(linkRequest("token=abc&next=%2Fdashboard"))).rejects.toEqual(new RedirectError("/dashboard"));
    expect(authService.verifyMagicLink).toHaveBeenCalledWith("abc");
    expect(cookieJar.get(SESSION_COOKIE)?.value).toBe(SESSION.token);
  });

  it("redirects home when next points off-site", async () => {
    authService.verifyMagicLink.mockResolvedValue(SESSION);

    await expect(GET(linkRequest("token=abc&next=%2F%2Fevil.example"))).rejects.toEqual(new RedirectError("/"));
  });

  it("redirects to login with an error when the link is invalid", async () => {
    authService.verifyMagicLink.mockRejectedValue(new InvalidMagicLinkError());

    await expect(GET(linkRequest("token=used"))).rejects.toEqual(new RedirectError("/login?error=invalid-link"));
    expect(cookieJar.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("redirects to login with an error when the token is missing", async () => {
    await expect(GET(linkRequest(""))).rejects.toEqual(new RedirectError("/login?error=invalid-link"));
    expect(authService.verifyMagicLink).not.toHaveBeenCalled();
  });

  it("rethrows unexpected failures", async () => {
    authService.verifyMagicLink.mockRejectedValue(new Error("database down"));

    await expect(GET(linkRequest("token=abc"))).rejects.toThrow("database down");
  });
});
