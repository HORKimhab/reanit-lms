import { describe, expect, it } from "vitest";

import { getMockOutline, saveMockOutline, type Outline } from "./outline";
import { MOCK_SCHOOL_SLUG } from "./schools";

const COURSE = "social-media-content";
const SAVED: Outline = { sections: [{ id: "s9", title: "Only section", lessons: [] }] };

describe("getMockOutline", () => {
  it("builds the outline from the catalog course with section and lesson ids", () => {
    const outline = getMockOutline(MOCK_SCHOOL_SLUG, "brand-design-basics");
    expect(outline?.sections.map((s) => [s.id, s.title, s.lessons.length])).toEqual([
      ["s1", "Getting started", 3],
      ["s2", "Logo design", 3],
      ["s3", "Color and type", 3],
    ]);
    expect(outline?.sections[0]?.lessons[1]).toEqual({
      id: "s1-l2",
      title: "What makes a brand",
      type: "video",
      durationSec: 610,
    });
  });

  it("returns undefined when the school has no course with that slug", () => {
    expect(getMockOutline(MOCK_SCHOOL_SLUG, "no-such-course")).toBeUndefined();
  });
});

describe("saveMockOutline", () => {
  it("returns the saved outline on the next load", () => {
    saveMockOutline(MOCK_SCHOOL_SLUG, COURSE, SAVED);
    expect(getMockOutline(MOCK_SCHOOL_SLUG, COURSE)).toEqual(SAVED);
  });

  it("keeps a copy, so later edits to the saved object are not stored", () => {
    const outline = structuredClone(SAVED);
    saveMockOutline(MOCK_SCHOOL_SLUG, COURSE, outline);
    outline.sections.pop();
    expect(getMockOutline(MOCK_SCHOOL_SLUG, COURSE)).toEqual(SAVED);
  });

  it("never shows one school's save to another school", () => {
    saveMockOutline("other-school", "brand-design-basics", SAVED);
    expect(getMockOutline(MOCK_SCHOOL_SLUG, "brand-design-basics")?.sections).toHaveLength(3);
  });
});
