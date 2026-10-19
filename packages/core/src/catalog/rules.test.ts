import { describe, expect, it } from "vitest";

import { createCourseSchema, outlineSchema, outlineStats, uniqueCourseSlug, updateCourseSchema } from "./rules";

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

/**
 * Builds a video lesson of the given length.
 *
 * @param durationSeconds Running time.
 * @returns The lesson.
 */
function videoLesson(durationSeconds: number) {
  return { id: "x", title: "x", type: "video" as const, durationSeconds };
}

describe("outlineStats", () => {
  it("counts lessons across sections and adds up their length", () => {
    const sections = [
      { id: "a", title: "A", lessons: [videoLesson(60), videoLesson(0)] },
      { id: "b", title: "B", lessons: [videoLesson(240)] },
    ];

    expect(outlineStats({ sections })).toEqual({ lessons: 3, durationSeconds: 300 });
  });

  it("is zero for a course without lessons", () => {
    expect(outlineStats({ sections: [{ id: "a", title: "A", lessons: [] }] })).toEqual({ lessons: 0, durationSeconds: 0 });
  });
});
