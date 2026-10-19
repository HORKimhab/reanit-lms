import { describe, expect, it } from "vitest";

import { getMockSchool, MOCK_SCHOOL_SLUG, requireMockSchool } from "./schools";

describe("getMockSchool", () => {
  it("returns the school when the slug exists", () => {
    expect(getMockSchool(MOCK_SCHOOL_SLUG)?.name).toBe("Angkor Academy");
  });

  it("returns undefined when the slug is unknown", () => {
    expect(getMockSchool("no-such-school")).toBeUndefined();
  });
});

describe("requireMockSchool", () => {
  it("returns the school when the slug exists", () => {
    expect(requireMockSchool(MOCK_SCHOOL_SLUG).slug).toBe(MOCK_SCHOOL_SLUG);
  });

  it("throws when the slug is unknown", () => {
    expect(() => requireMockSchool("no-such-school")).toThrow("Unknown school: no-such-school");
  });
});
