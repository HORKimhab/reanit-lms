// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const VALID = { API_URL: "http://localhost:4000" };

beforeEach(() => {
  // getServerEnv caches its first result, so each test needs a fresh module.
  vi.resetModules();
});

/**
 * Imports a fresh copy of the env module.
 *
 * @returns The module's `getServerEnv`.
 */
async function loadGetServerEnv() {
  return (await import("./env")).getServerEnv;
}

describe("getServerEnv", () => {
  it("returns the validated variables when all are set", async () => {
    const getServerEnv = await loadGetServerEnv();

    expect(getServerEnv({ ...VALID, UNRELATED: "x" })).toEqual(VALID);
  });

  it("throws a ZodError when a variable is missing", async () => {
    const getServerEnv = await loadGetServerEnv();
    expect(() => getServerEnv({ ...VALID, API_URL: undefined })).toThrow(ZodError);
  });

  it("throws a ZodError when a URL is malformed", async () => {
    const getServerEnv = await loadGetServerEnv();

    expect(() => getServerEnv({ ...VALID, API_URL: "localhost" })).toThrow(ZodError);
  });

  it("reuses the first result instead of re-reading the environment", async () => {
    const getServerEnv = await loadGetServerEnv();
    getServerEnv(VALID);

    expect(getServerEnv({})).toEqual(VALID);
  });
});

describe("getRootDomain", () => {
  it("returns the lower-cased root domain", async () => {
    const { getRootDomain } = await import("./env");

    expect(getRootDomain({ ROOT_DOMAIN: "Reanit.com" })).toBe("reanit.com");
  });

  it("keeps a port", async () => {
    const { getRootDomain } = await import("./env");

    expect(getRootDomain({ ROOT_DOMAIN: "localhost:3000" })).toBe("localhost:3000");
  });

  it.each([[undefined], [""]])("returns undefined when unset (%j)", async (value) => {
    const { getRootDomain } = await import("./env");

    expect(getRootDomain({ ROOT_DOMAIN: value })).toBeUndefined();
  });

  it("throws a ZodError when it is a URL instead of a host", async () => {
    const { getRootDomain } = await import("./env");

    expect(() => getRootDomain({ ROOT_DOMAIN: "https://reanit.com" })).toThrow(ZodError);
  });
});
