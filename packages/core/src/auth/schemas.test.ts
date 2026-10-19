import { describe, expect, it } from "vitest";

import { emailSchema, logInSchema, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, signUpSchema } from "./schemas";

const VALID = { name: "Dara", email: "dara@example.com", password: "a".repeat(PASSWORD_MIN_LENGTH) };

describe("auth schemas", () => {
  it("normalizes email by trimming and lower-casing it", () => {
    expect(emailSchema.parse("  Dara@Example.COM ")).toBe("dara@example.com");
  });

  it("rejects an invalid email", () => {
    expect(emailSchema.safeParse("dara@").success).toBe(false);
  });

  it("accepts a password at the minimum length", () => {
    expect(signUpSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects a sign-up password below the minimum length", () => {
    expect(signUpSchema.safeParse({ ...VALID, password: "a".repeat(PASSWORD_MIN_LENGTH - 1) }).success).toBe(false);
  });

  it("rejects a password above the maximum length", () => {
    expect(logInSchema.safeParse({ ...VALID, password: "a".repeat(PASSWORD_MAX_LENGTH + 1) }).success).toBe(false);
  });

  it("rejects a blank name", () => {
    expect(signUpSchema.safeParse({ ...VALID, name: "   " }).success).toBe(false);
  });

  it("accepts a short login password, since only a match matters", () => {
    expect(logInSchema.safeParse({ email: VALID.email, password: "x" }).success).toBe(true);
  });
});
