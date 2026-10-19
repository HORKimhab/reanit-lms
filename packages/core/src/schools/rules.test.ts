import { describe, expect, it } from "vitest";

import { createSchoolSchema, subdomainSchema } from "./rules";

describe("subdomainSchema", () => {
  it("lower-cases and trims the subdomain", () => {
    expect(subdomainSchema.parse("  Angkor-Academy ")).toBe("angkor-academy");
  });

  it.each(["abc", "a1-b2", "x".repeat(63)])("accepts %s", (subdomain) => {
    expect(subdomainSchema.safeParse(subdomain).success).toBe(true);
  });

  it.each(["ab", "x".repeat(64), "-angkor", "angkor-", "ang kor", "angkor.academy", "អង្គរ", "ang_kor"])(
    "rejects %s",
    (subdomain) => {
      expect(subdomainSchema.safeParse(subdomain).success).toBe(false);
    },
  );

  it.each(["www", "APP", "api"])("rejects the reserved subdomain %s", (subdomain) => {
    expect(subdomainSchema.safeParse(subdomain).success).toBe(false);
  });
});

describe("createSchoolSchema", () => {
  it("accepts a Khmer school name", () => {
    expect(createSchoolSchema.parse({ name: " សាលាអង្គរ ", subdomain: "angkor" })).toEqual({
      name: "សាលាអង្គរ",
      subdomain: "angkor",
    });
  });

  it("rejects a blank name", () => {
    expect(createSchoolSchema.safeParse({ name: "  ", subdomain: "angkor" }).success).toBe(false);
  });
});
