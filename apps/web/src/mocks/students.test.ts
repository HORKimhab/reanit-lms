import { describe, expect, it } from "vitest";

import { MOCK_SCHOOL_SLUG } from "./schools";
import { getMockStudents } from "./students";

describe("getMockStudents", () => {
  it("lists the school's students newest first with enrolled and completed course counts", () => {
    expect(getMockStudents(MOCK_SCHOOL_SLUG).map((s) => [s.name, s.joinedOn, s.courses, s.completedCourses])).toEqual([
      ["Dara Pich", "2026-09-21", 1, 0],
      ["Vanna Lim", "2026-08-02", 1, 1],
      ["Sokha Chan", "2026-03-14", 2, 1],
    ]);
  });

  it("never lists another school's students", () => {
    expect(getMockStudents(MOCK_SCHOOL_SLUG).map((s) => s.id)).not.toContain("st-9");
  });

  it("returns nothing for a school without students", () => {
    expect(getMockStudents("empty-school")).toEqual([]);
  });
});
