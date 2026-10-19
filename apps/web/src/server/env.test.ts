// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const VALID = {
  DATABASE_URL: "postgresql://reanit:reanit@localhost:5432/reanit",
  APP_URL: "http://localhost:3000",
  SMTP_URL: "smtp://localhost:1025",
  MAIL_FROM: "Reanit <no-reply@reanit.test>",
};

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
    expect(() => getServerEnv({ ...VALID, SMTP_URL: undefined })).toThrow(ZodError);
  });

  it("throws a ZodError when a URL is malformed", async () => {
    const getServerEnv = await loadGetServerEnv();

    expect(() => getServerEnv({ ...VALID, APP_URL: "localhost" })).toThrow(ZodError);
  });

  it("reuses the first result instead of re-reading the environment", async () => {
    const getServerEnv = await loadGetServerEnv();
    getServerEnv(VALID);

    expect(getServerEnv({})).toEqual(VALID);
  });
});
