import { describe, expect, it } from "vitest";

import { createSchoolSchema, schoolSettingsSchema, studentSearchSchema, subdomainSchema, suggestSubdomain } from "./rules";

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

describe("suggestSubdomain", () => {
  it("suggests a valid subdomain from an ordinary name", () => {
    expect(suggestSubdomain("Phnom Penh Coding School")).toBe("phnom-penh-coding-school");
  });

  it("caps the suggestion at the 63-character DNS label limit", () => {
    expect(suggestSubdomain("a".repeat(70))).toHaveLength(63);
  });
});

describe("schoolSettingsSchema", () => {
  it("trims the name and lower-cases the brand color", () => {
    expect(schoolSettingsSchema.parse({ name: " Angkor ", brandColor: "#00AA55" })).toEqual({ name: "Angkor", brandColor: "#00aa55" });
  });

  it("keeps a null brand color and a null logo key", () => {
    expect(schoolSettingsSchema.parse({ name: "Angkor", brandColor: null, logoKey: null })).toEqual({
      name: "Angkor",
      brandColor: null,
      logoKey: null,
    });
  });

  it.each(["00aa55", "#0a5", "#00aa5g", "red", "#00aa55ff"])("rejects the brand color %s", (brandColor) => {
    expect(schoolSettingsSchema.safeParse({ name: "Angkor", brandColor }).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(schoolSettingsSchema.safeParse({ name: "  ", brandColor: null }).success).toBe(false);
  });
});

describe("studentSearchSchema", () => {
  it("defaults to the first page and reads the page from a query string", () => {
    expect(studentSearchSchema.parse({})).toEqual({ page: 1 });
    expect(studentSearchSchema.parse({ q: " sokha ", page: "2" })).toEqual({ q: "sokha", page: 2 });
  });

  it.each(["0", "-1", "1.5", "two"])("rejects page %s", (page) => {
    expect(studentSearchSchema.safeParse({ page }).success).toBe(false);
  });
});
