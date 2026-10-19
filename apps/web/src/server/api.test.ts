// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, requestTo, SESSION_TOKEN } from "@/test/api";
import { requestHeaders } from "@/test/headers";
import { signIn } from "@/test/session";

import { getApi } from "./api";

vi.mock("next/headers", () => import("@/test/headers"));

/**
 * Sends one request through the client and returns what the API received.
 *
 * @returns The request.
 */
async function sentRequest() {
  onApi("GET /auth/me", Response.json({ user: null }));
  await (await getApi()).GET("/auth/me");
  // The call above awaited the answer, so the request was recorded.
  return requestTo("GET /auth/me")!;
}

describe("getApi", () => {
  it("forwards the visitor's session cookie", async () => {
    signIn();

    expect((await sentRequest()).headers.get("cookie")).toBe(`reanit_session=${SESSION_TOKEN}`);
  });

  it("forwards the browser's address chain, so the API's rate limits count the browser", async () => {
    requestHeaders.set("x-forwarded-for", "203.0.113.7");

    expect((await sentRequest()).headers.get("x-forwarded-for")).toBe("203.0.113.7");
  });

  it("sends neither when the request has none", async () => {
    const request = await sentRequest();

    expect(request.headers.get("cookie")).toBeNull();
    expect(request.headers.get("x-forwarded-for")).toBeNull();
  });
});
