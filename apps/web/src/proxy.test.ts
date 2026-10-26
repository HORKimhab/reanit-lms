// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";

import proxy from "./proxy";

beforeEach(() => {
  vi.stubEnv("ROOT_DOMAIN", "reanit.test");
});

/**
 * Runs the proxy for a URL, with the URL's host as the `Host` header.
 *
 * @param url Full request URL.
 * @param headers Extra request headers.
 * @returns The proxy's response.
 */
function visit(url: string, headers: Record<string, string> = {}) {
  return proxy(new NextRequest(url, { headers: { host: new URL(url).host, ...headers } }));
}

describe("proxy", () => {
  it("serves a school subdomain from the school's routes in the default locale", async () => {
    const response = await visit("http://angkor.reanit.test/courses/intro");

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://angkor.reanit.test/en/s/angkor/courses/intro");
    expect(response.headers.has("x-middleware-next")).toBe(false);
  });

  it("keeps the Khmer prefix when serving a school subdomain", async () => {
    const response = await visit("http://angkor.reanit.test/km/my-courses");

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://angkor.reanit.test/km/s/angkor/my-courses");
    // next-intl passes prefixed paths through; the pass-through flag must not survive the rewrite.
    expect(response.headers.has("x-middleware-next")).toBe(false);
  });

  it("serves the platform log-in page on a school subdomain", async () => {
    const response = await visit("http://angkor.reanit.test/login");

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://angkor.reanit.test/en/login");
  });

  it("passes locale redirects through untouched", async () => {
    const response = await visit("http://angkor.reanit.test/en/courses");

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/courses"); // next-intl drops the default prefix
    expect(response.headers.has("x-middleware-rewrite")).toBe(false);
  });

  it("leaves the root domain to locale routing only", async () => {
    const response = await visit("http://reanit.test/courses");

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://reanit.test/en/courses");
  });

  it("does no subdomain routing when ROOT_DOMAIN is unset", async () => {
    vi.stubEnv("ROOT_DOMAIN", "");

    const response = await visit("http://angkor.reanit.test/courses");

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://angkor.reanit.test/en/courses");
  });

  it("serves a school's verified custom domain from the school's routes", async () => {
    onApi("GET /schools/by-domain/learn.angkor.com", Response.json({ subdomain: "angkor" }));

    const response = await visit("http://learn.angkor.com/courses/intro");

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://learn.angkor.com/en/s/angkor/courses/intro");
  });

  it("leaves a domain no school has verified to locale routing only", async () => {
    onApi("GET /schools/by-domain/unknown.example.com", problem(404, "urn:reanit:problem:domain-not-found"));

    const response = await visit("http://unknown.example.com/courses");

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://unknown.example.com/en/courses");
  });

  it("never asks the API about the platform's own hosts", async () => {
    await visit("http://reanit.test/courses");
    await visit("http://nested.angkor.reanit.test/courses");

    expect(requestTo("GET /schools/by-domain/reanit.test")).toBeUndefined();
    expect(requestTo("GET /schools/by-domain/nested.angkor.reanit.test")).toBeUndefined();
  });
});
