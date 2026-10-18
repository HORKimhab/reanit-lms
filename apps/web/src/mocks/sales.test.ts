import { describe, expect, it } from "vitest";

import { getMockCourseSales, summarizeSales, type CourseSales } from "./sales";
import { MOCK_SCHOOL_SLUG } from "./schools";

const SALES = getMockCourseSales(MOCK_SCHOOL_SLUG);
const [BRAND] = SALES as [CourseSales, ...CourseSales[]];

describe("getMockCourseSales", () => {
  it("returns the school's courses with sales, most students first", () => {
    expect(SALES.map((s) => [s.course.slug, s.students])).toEqual([
      ["brand-design-basics", 128],
      ["social-media-content", 54],
    ]);
  });

  it("returns nothing for another school", () => {
    expect(getMockCourseSales("other-school")).toEqual([]);
  });
});

describe("summarizeSales", () => {
  it("adds students and keeps revenue separate per currency", () => {
    expect(summarizeSales(SALES)).toEqual({
      students: 182,
      completionRate: 63 / 182,
      revenue: [
        { currency: "KHR", amountMinor: 648000000 },
        { currency: "USD", amountMinor: 627200 },
      ],
    });
  });

  it("adds revenue of courses in the same currency", () => {
    expect(summarizeSales([BRAND, { ...BRAND, revenueMinor: 100 }]).revenue).toEqual([
      { currency: "USD", amountMinor: 627300 },
    ]);
  });

  it("reports a 0 completion rate instead of dividing by zero when there are no students", () => {
    expect(summarizeSales([])).toEqual({ students: 0, completionRate: 0, revenue: [] });
  });
});
