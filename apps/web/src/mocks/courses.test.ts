import { describe, expect, it } from "vitest";

import { courseStats, flattenLessons, getMockCourse, getMockCourses, type MockCourse } from "./courses";
import { MOCK_SCHOOL_SLUG } from "./schools";

const EMPTY_COURSE = { ...(getMockCourse(MOCK_SCHOOL_SLUG, "brand-design-basics") as MockCourse), sections: [] };

describe("getMockCourses", () => {
  it("returns only the given school's courses", () => {
    const courses = getMockCourses(MOCK_SCHOOL_SLUG);
    expect(courses.length).toBeGreaterThan(0);
    expect(courses.every((c) => c.schoolSlug === MOCK_SCHOOL_SLUG)).toBe(true);
  });

  it("returns nothing for another school", () => {
    expect(getMockCourses("other-school")).toEqual([]);
  });
});

describe("getMockCourse", () => {
  it("finds a course by school and slug", () => {
    expect(getMockCourse(MOCK_SCHOOL_SLUG, "brand-design-basics")?.title).toBe("Brand Design Basics");
  });

  it("does not return a course through another school's slug", () => {
    expect(getMockCourse("other-school", "brand-design-basics")).toBeUndefined();
  });
});

describe("courseStats", () => {
  it("counts lessons and sums their durations", () => {
    const course = getMockCourse(MOCK_SCHOOL_SLUG, "social-media-content") as MockCourse;
    expect(courseStats(course)).toEqual({ lessons: 4, durationSec: 480 + 0 + 1100 + 780 });
  });

  it("returns zeros when the course has no lessons", () => {
    expect(courseStats(EMPTY_COURSE)).toEqual({ lessons: 0, durationSec: 0 });
  });
});

describe("flattenLessons", () => {
  it("numbers lessons across sections with section-lesson ids", () => {
    const course = getMockCourse(MOCK_SCHOOL_SLUG, "social-media-content") as MockCourse;
    expect(flattenLessons(course).map((l) => [l.id, l.index, l.sectionIndex, l.sectionTitle])).toEqual([
      ["1-1", 0, 0, "Planning"],
      ["1-2", 1, 0, "Planning"],
      ["2-1", 2, 1, "Shooting and editing"],
      ["2-2", 3, 1, "Shooting and editing"],
    ]);
  });

  it("returns an empty list when the course has no lessons", () => {
    expect(flattenLessons(EMPTY_COURSE)).toEqual([]);
  });
});
