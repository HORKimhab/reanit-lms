import { afterEach, describe, expect, it } from "vitest";

import { createAdapter } from "./request-id";

/** The Fastify app a test booted, closed after it. */
let running: { close: () => Promise<unknown> } | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
});

/**
 * Builds a Fastify app that answers with the caller's address, as rate limits see it.
 *
 * @param trustProxyHops Proxies to trust.
 * @returns The Fastify instance.
 */
async function appSeeingIp(trustProxyHops?: number) {
  const fastify = createAdapter(trustProxyHops === undefined ? undefined : { trustProxyHops }).getInstance();
  fastify.get("/ip", async (request) => request.ip);
  await fastify.ready();
  running = fastify;
  return fastify;
}

/**
 * Asks for the caller's address from a proxy at 10.0.0.2 that forwards a chain of addresses.
 *
 * @param fastify The app.
 * @param forwardedFor The X-Forwarded-For chain.
 * @returns The address the app saw.
 */
async function ipSeenThrough(fastify: Awaited<ReturnType<typeof appSeeingIp>>, forwardedFor: string) {
  return (await fastify.inject({ method: "GET", url: "/ip", remoteAddress: "10.0.0.2", headers: { "x-forwarded-for": forwardedFor } })).body;
}

describe("createAdapter", () => {
  it("ignores X-Forwarded-For by default, so callers cannot fake their address", async () => {
    expect(await ipSeenThrough(await appSeeingIp(), "203.0.113.7")).toBe("10.0.0.2");
  });

  it("reads the caller's address through as many proxies as it trusts", async () => {
    expect(await ipSeenThrough(await appSeeingIp(1), "203.0.113.7")).toBe("203.0.113.7");
    expect(await ipSeenThrough(await appSeeingIp(2), "203.0.113.7, 10.0.0.1")).toBe("203.0.113.7");
  });

  it("never trusts an address added before the trusted proxies", async () => {
    expect(await ipSeenThrough(await appSeeingIp(1), "198.51.100.9, 203.0.113.7")).toBe("203.0.113.7");
  });
});
