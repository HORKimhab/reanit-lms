import { afterEach, describe, expect, it } from "vitest";

import { getMockSchool, isAllowedLogo, MOCK_SCHOOL_SLUG, requireMockSchool, updateMockSchool } from "./schools";

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

describe("updateMockSchool", () => {
  const { name, brand } = requireMockSchool(MOCK_SCHOOL_SLUG);

  afterEach(() => {
    updateMockSchool(MOCK_SCHOOL_SLUG, { name, brand, logoUrl: undefined });
  });

  it("changes the name and brand and keeps the logo when none is given", () => {
    updateMockSchool(MOCK_SCHOOL_SLUG, { name: "Angkor Academy", brand: "#008b52", logoUrl: "data:image/png;base64,AA" });
    updateMockSchool(MOCK_SCHOOL_SLUG, { name: "Angkor Studio", brand: "#112233" });
    expect(requireMockSchool(MOCK_SCHOOL_SLUG)).toMatchObject({
      name: "Angkor Studio",
      brand: "#112233",
      logoUrl: "data:image/png;base64,AA",
      tagline: "Practical courses for Cambodian creators.",
    });
  });

  it("throws when the slug is unknown", () => {
    expect(() => updateMockSchool("no-such-school", { name: "X", brand: "#000000" })).toThrow(
      "Unknown school: no-such-school",
    );
  });
});

describe("isAllowedLogo", () => {
  it.each([
    ["a PNG of exactly 1 MB", { type: "image/png", size: 1024 * 1024 }, true],
    ["a JPEG", { type: "image/jpeg", size: 10 }, true],
    ["a WebP", { type: "image/webp", size: 10 }, true],
    ["a file over 1 MB", { type: "image/png", size: 1024 * 1024 + 1 }, false],
    ["an SVG", { type: "image/svg+xml", size: 10 }, false],
    ["a PDF", { type: "application/pdf", size: 10 }, false],
  ])("returns the right answer for %s", (_case, file, expected) => {
    expect(isAllowedLogo(file)).toBe(expected);
  });
});
