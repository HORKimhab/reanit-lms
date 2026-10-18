import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { getMockOutline, type Outline } from "@/mocks/outline";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";

import { saveCourseOutline } from "./actions";

const COURSE = "brand-design-basics";
const OUTLINE: Outline = {
  sections: [{ id: "s1", title: "Start", lessons: [{ id: "l1", title: "Hi", type: "text", durationSec: 0 }] }],
};

describe("saveCourseOutline", () => {
  it("stores a valid outline so the builder loads it next time", async () => {
    await saveCourseOutline(COURSE, OUTLINE);
    expect(getMockOutline(MOCK_SCHOOL_SLUG, COURSE)).toEqual(OUTLINE);
  });

  it("drops fields the schema does not know", async () => {
    await saveCourseOutline(COURSE, { ...OUTLINE, isAdmin: true });
    expect(getMockOutline(MOCK_SCHOOL_SLUG, COURSE)).toEqual(OUTLINE);
  });

  it.each([
    ["an unknown lesson type", { id: "l1", title: "Hi", type: "quiz", durationSec: 0 }],
    ["a negative duration", { id: "l1", title: "Hi", type: "text", durationSec: -1 }],
    ["an empty id", { id: "", title: "Hi", type: "text", durationSec: 0 }],
    ["a title over 200 characters", { id: "l1", title: "x".repeat(201), type: "text", durationSec: 0 }],
  ])("rejects a lesson with %s", async (_case, lesson) => {
    const outline = { sections: [{ id: "s1", title: "Start", lessons: [lesson] }] };
    await expect(saveCourseOutline(COURSE, outline)).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects a course the school does not have", async () => {
    await expect(saveCourseOutline("no-such-course", OUTLINE)).rejects.toThrow("Unknown course: no-such-course");
  });
});
