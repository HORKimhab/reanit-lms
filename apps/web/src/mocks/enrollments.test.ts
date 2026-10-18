import { describe, expect, it } from "vitest";

import { getMockCourse, type MockCourse } from "./courses";
import { getMockEnrollment, getMockEnrollments, getResumeLesson, toEnrollment } from "./enrollments";
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

describe("getMockEnrollment", () => {
  it("finds the enrollment for a course", () => {
    expect(getMockEnrollment(MOCK_SCHOOL_SLUG, "social-media-content")?.isCompleted).toBe(true);
  });

  it("returns undefined when the student is not enrolled", () => {
    expect(getMockEnrollment(MOCK_SCHOOL_SLUG, "no-such-course")).toBeUndefined();
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

describe("getResumeLesson", () => {
  it("returns the first unfinished lesson", () => {
    expect(getResumeLesson(toEnrollment(BRAND, 4))?.id).toBe("2-2");
  });

  it("returns the first lesson when nothing is done yet", () => {
    expect(getResumeLesson(toEnrollment(BRAND, 0))?.id).toBe("1-1");
  });

  it("returns the last lesson when the course is completed", () => {
    expect(getResumeLesson(toEnrollment(BRAND, 9))?.id).toBe("3-3");
  });

  it("returns undefined when the course has no lessons", () => {
    expect(getResumeLesson(toEnrollment(EMPTY_COURSE, 0))).toBeUndefined();
  });
});
