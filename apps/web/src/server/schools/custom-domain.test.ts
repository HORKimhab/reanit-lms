// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";

import { createCustomDomainResolver } from "./custom-domain";

const MINUTE_MS = 60_000;

/**
 * Builds a resolver over a lookup spy and a clock the test moves.
 *
 * @param answer What the lookup answers.
 * @returns The resolver, the lookup spy, and the clock.
 */
function resolverAnswering(answer: () => Promise<string | null>) {
  const clock = { now: 0 };
  const lookUp = vi.fn(answer);
  return { resolve: createCustomDomainResolver(lookUp, () => clock.now), lookUp, clock };
}

describe("createCustomDomainResolver", () => {
  it("resolves a host to the school its lookup names, normalized", async () => {
    const { resolve, lookUp } = resolverAnswering(async () => "angkor");

    expect(await resolve("Learn.Angkor.com")).toBe("angkor");
    expect(lookUp).toHaveBeenCalledWith("learn.angkor.com");
  });

  it.each(["localhost:3000", "10.0.0.1", "learn.angkor.com:8443"])("never looks up %s, which cannot be a custom domain", async (host) => {
    const { resolve, lookUp } = resolverAnswering(async () => "angkor");

    expect(await resolve(host)).toBeNull();
    expect(lookUp).not.toHaveBeenCalled();
  });

  it("reuses an answer for a minute, then looks the host up again", async () => {
    const { resolve, lookUp, clock } = resolverAnswering(async () => "angkor");
    await resolve("learn.angkor.com");

    clock.now = MINUTE_MS - 1;
    await resolve("learn.angkor.com");
    expect(lookUp).toHaveBeenCalledTimes(1);

    clock.now = MINUTE_MS;
    await resolve("learn.angkor.com");
    expect(lookUp).toHaveBeenCalledTimes(2);
  });

  it("reuses the answer that no school serves the host", async () => {
    const { resolve, lookUp } = resolverAnswering(async () => null);

    expect(await resolve("unknown.example.com")).toBeNull();
    expect(await resolve("unknown.example.com")).toBeNull();
    expect(lookUp).toHaveBeenCalledTimes(1);
  });

  it("asks again after a failed lookup instead of remembering the failure", async () => {
    const { resolve, lookUp } = resolverAnswering(async () => "angkor");
    lookUp.mockRejectedValueOnce(new Error("API down"));

    await expect(resolve("learn.angkor.com")).rejects.toThrow("API down");
    expect(await resolve("learn.angkor.com")).toBe("angkor");
  });
});

describe("createCustomDomainResolver over the API", () => {
  it("resolves a verified domain to its school's subdomain", async () => {
    onApi("GET /schools/by-domain/learn.angkor.com", Response.json({ subdomain: "angkor" }));

    expect(await createCustomDomainResolver()("learn.angkor.com")).toBe("angkor");
  });

  it("resolves a domain no school has verified to null", async () => {
    onApi("GET /schools/by-domain/learn.angkor.com", problem(404, "urn:reanit:problem:domain-not-found"));

    expect(await createCustomDomainResolver()("learn.angkor.com")).toBeNull();
  });

  it("throws when the API fails", async () => {
    onApi("GET /schools/by-domain/learn.angkor.com", problem(500));

    await expect(createCustomDomainResolver()("learn.angkor.com")).rejects.toThrow("API answered 500");
  });
});
