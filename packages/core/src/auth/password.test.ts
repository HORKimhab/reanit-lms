import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the password it hashed", async () => {
    const hash = await hashPassword("correct horse");

    expect(await verifyPassword("correct horse", hash)).toBe(true);
  });

  it("rejects a different password", async () => {
    const hash = await hashPassword("correct horse");

    expect(await verifyPassword("correct hors", hash)).toBe(false);
  });

  it("salts each hash so equal passwords hash differently", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("never stores the password in the hash", async () => {
    expect(await hashPassword("plain-secret")).not.toContain("plain-secret");
  });

  it("verifies a non-ASCII password", async () => {
    const hash = await hashPassword("ពាក្យសម្ងាត់");

    expect(await verifyPassword("ពាក្យសម្ងាត់", hash)).toBe(true);
  });

  it("throws when the stored hash is not in the expected format", async () => {
    await expect(verifyPassword("x", "bcrypt$2b$10$abc")).rejects.toThrow("Unsupported password hash format");
  });
});
