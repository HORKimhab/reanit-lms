import { describe, expect, it } from "vitest";

import { createCourseSchema, outlineSchema, uniqueCourseSlug, updateCourseSchema } from "./rules";

const SECTION_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01";
const LESSON_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a02";

/**
 * Builds a one-section, one-lesson outline.
 *
 * @param lesson Lesson fields to override.
 * @returns The outline input.
 */
function outlineWith(lesson: Record<string, unknown> = {}) {
  return {
    sections: [
      { id: SECTION_ID, title: "Basics", lessons: [{ id: LESSON_ID, title: "Hello", type: "video", durationSeconds: 90, ...lesson }] },
    ],
  };
}

describe("uniqueCourseSlug", () => {
  it("slugifies the title", () => {
    expect(uniqueCourseSlug("Intro to Design", [])).toBe("intro-to-design");
  });

  it("numbers the slug when it is taken", () => {
    expect(uniqueCourseSlug("Intro", ["intro", "intro-2"])).toBe("intro-3");
  });

  it("falls back to 'course' for a Khmer title", () => {
    expect(uniqueCourseSlug("រចនាក្រាហ្វិក", ["course"])).toBe("course-2");
  });
});

describe("course schemas", () => {
  it("trims a new course's title", () => {
    expect(createCourseSchema.parse({ title: "  Design  " })).toEqual({ title: "Design" });
  });

  it("rejects a blank title", () => {
    expect(createCourseSchema.safeParse({ title: "  " }).success).toBe(false);
  });

  it("accepts a partial update", () => {
    expect(updateCourseSchema.parse({ status: "published" })).toEqual({ status: "published" });
  });

  it("rejects an unknown status", () => {
    expect(updateCourseSchema.safeParse({ status: "archived" }).success).toBe(false);
  });
});

describe("outlineSchema", () => {
  it("accepts a valid outline, including a blank title being typed", () => {
    expect(outlineSchema.safeParse(outlineWith({ title: "" })).success).toBe(true);
  });

  it.each([
    ["a non-UUID id", { id: "s1-l1" }],
    ["an unknown lesson type", { type: "quiz" }],
    ["a negative duration", { durationSeconds: -1 }],
    ["a fractional duration", { durationSeconds: 1.5 }],
    ["a title over 200 characters", { title: "x".repeat(201) }],
  ])("rejects %s", (_case, lesson) => {
    expect(outlineSchema.safeParse(outlineWith(lesson)).success).toBe(false);
  });

  it("rejects an outline that reuses an id", () => {
    expect(outlineSchema.safeParse(outlineWith({ id: SECTION_ID })).success).toBe(false);
  });
});
