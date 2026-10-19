import { describe, expect, it } from "vitest";

import { getMockCourse, type MockCourse } from "./courses";
import { getMockEnrollments, toEnrollment } from "./enrollments";
import { MOCK_SCHOOL_SLUG } from "./schools";

const BRAND = getMockCourse(MOCK_SCHOOL_SLUG, "brand-design-basics") as MockCourse;
const EMPTY_COURSE = { ...BRAND, sections: [] };

describe("getMockEnrollments", () => {
  it("returns the student's enrollments in the school with progress", () => {
    const enrollments = getMockEnrollments(MOCK_SCHOOL_SLUG);
    expect(enrollments.map((e) => [e.course.slug, e.completedLessons, e.totalLessons])).toEqual([
      ["brand-design-basics", 4, 9],
      ["social-media-content", 4, 4],
    ]);
  });

  it("returns nothing for another school", () => {
    expect(getMockEnrollments("other-school")).toEqual([]);
  });
});

describe("toEnrollment", () => {
  it("computes percent and leaves the course unfinished when lessons remain", () => {
    const enrollment = toEnrollment(BRAND, 3);
    expect(enrollment.percent).toBeCloseTo((3 / 9) * 100);
    expect(enrollment.isCompleted).toBe(false);
  });

  it("marks the course completed when every lesson is done", () => {
    expect(toEnrollment(BRAND, 9)).toMatchObject({ percent: 100, isCompleted: true });
  });

  it("reports 0% instead of dividing by zero when the course has no lessons", () => {
    expect(toEnrollment(EMPTY_COURSE, 0)).toMatchObject({ totalLessons: 0, percent: 0 });
  });
});
