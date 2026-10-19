import { describe, expect, it } from "vitest";

import { PUBLISHED_COURSE_WITH_OUTLINE } from "@/test/site";

import { courseMetadata, summarize } from "./course-metadata";

const PAGE = {
  course: PUBLISHED_COURSE_WITH_OUTLINE,
  schoolName: "Angkor Academy",
  locale: "en" as const,
  origin: "https://angkor.reanit.com",
  sitePath: "",
  fallbackDescription: "A course from Angkor Academy.",
};

describe("courseMetadata", () => {
  it("titles the page with the course and school, described by the course", () => {
    expect(courseMetadata(PAGE)).toMatchObject({
      metadataBase: new URL("https://angkor.reanit.com"),
      title: "Brand Design Basics | Angkor Academy",
      description: "Design a logo, palette and type system.",
    });
  });

  it("points the canonical URL and each language at the course on the school's own subdomain", () => {
    expect(courseMetadata(PAGE).alternates).toEqual({
      canonical: "/courses/brand-design-basics",
      languages: { en: "/courses/brand-design-basics", km: "/km/courses/brand-design-basics" },
    });
  });

  it("keeps the school's path when the site is not on its subdomain, and the Khmer prefix for km", () => {
    const metadata = courseMetadata({ ...PAGE, locale: "km", origin: "https://reanit.com", sitePath: "/s/angkor" });

    expect(metadata.alternates?.canonical).toBe("/km/s/angkor/courses/brand-design-basics");
    expect(metadata.openGraph).toMatchObject({ url: "/km/s/angkor/courses/brand-design-basics", locale: "km_KH" });
  });

  it("describes the share card and asks for a large image", () => {
    const metadata = courseMetadata(PAGE);

    expect(metadata.openGraph).toMatchObject({ type: "website", title: "Brand Design Basics", siteName: "Angkor Academy", locale: "en_US" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title: "Brand Design Basics" });
  });

  it("falls back to a generic description when the course has none", () => {
    expect(courseMetadata({ ...PAGE, course: { ...PAGE.course, description: null } }).description).toBe("A course from Angkor Academy.");
  });
});

describe("summarize", () => {
  it("keeps text that fits, with its whitespace flattened", () => {
    expect(summarize("  Design   a\nlogo ", 160)).toBe("Design a logo");
  });

  it("cuts long text at a word boundary with an ellipsis", () => {
    expect(summarize("one two three four", 12)).toBe("one two…");
  });

  it("cuts inside a word when there is no space to cut at", () => {
    expect(summarize("abcdefghijkl", 6)).toBe("abcde…");
  });
});
