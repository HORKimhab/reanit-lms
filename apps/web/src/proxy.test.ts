// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  it("serves a school subdomain from the school's routes in the default locale", () => {
    const response = visit("http://angkor.reanit.test/courses/intro");

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://angkor.reanit.test/en/s/angkor/courses/intro");
    expect(response.headers.has("x-middleware-next")).toBe(false);
  });

  it("keeps the Khmer prefix when serving a school subdomain", () => {
    const response = visit("http://angkor.reanit.test/km/my-courses");

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://angkor.reanit.test/km/s/angkor/my-courses");
    // next-intl passes prefixed paths through; the pass-through flag must not survive the rewrite.
    expect(response.headers.has("x-middleware-next")).toBe(false);
  });

  it("serves the platform log-in page on a school subdomain", () => {
    const response = visit("http://angkor.reanit.test/login");

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://angkor.reanit.test/en/login");
  });

  it("passes locale redirects through untouched", () => {
    const response = visit("http://angkor.reanit.test/en/courses");

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/courses"); // next-intl drops the default prefix
    expect(response.headers.has("x-middleware-rewrite")).toBe(false);
  });

  it("leaves the root domain to locale routing only", () => {
    const response = visit("http://reanit.test/courses");

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://reanit.test/en/courses");
  });

  it("does no subdomain routing when ROOT_DOMAIN is unset", () => {
    vi.stubEnv("ROOT_DOMAIN", "");

    const response = visit("http://angkor.reanit.test/courses");

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://angkor.reanit.test/en/courses");
  });
});
