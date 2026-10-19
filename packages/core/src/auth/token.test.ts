import { describe, expect, it } from "vitest";

import { generateToken, hashToken } from "./token";

describe("tokens", () => {
  it("generates a URL-safe 256-bit token", () => {
    expect(generateToken()).toMatch(/^[\w-]{43}$/);
  });

  it("generates a different token each time", () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  it("hashes the same token to the same value", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("hashes to SHA-256 hex, not the token itself", () => {
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
