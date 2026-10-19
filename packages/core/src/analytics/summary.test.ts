import { describe, expect, it } from "vitest";

import type { CourseStats } from "./ports";
import { summarizeCourseStats } from "./summary";

const BRAND: CourseStats = {
  courseId: "8d7c6b5a-4f3e-4d2c-9b1a-0f9e8d7c6b5a",
  title: "Brand Design Basics",
  slug: "brand",
  students: 3,
  completions: 1,
  revenue: [
    { currency: "KHR", amount: 6_000_000 },
    { currency: "USD", amount: 4_900 },
  ],
};

const SOCIAL: CourseStats = {
  courseId: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d",
  title: "Social Media",
  slug: "social",
  students: 1,
  completions: 1,
  revenue: [{ currency: "USD", amount: 2_500 }],
};

describe("summarizeCourseStats", () => {
  it("adds students and keeps revenue separate per currency, sorted by code", () => {
    expect(summarizeCourseStats([SOCIAL, BRAND])).toEqual({
      students: 4,
      completionRate: 0.5,
      revenue: [
        { currency: "KHR", amount: 6_000_000 },
        { currency: "USD", amount: 7_400 },
      ],
    });
  });

  it("reports no revenue and a 0 completion rate when nothing was sold", () => {
    const unsold = { ...BRAND, students: 0, completions: 0, revenue: [] };

    expect(summarizeCourseStats([unsold])).toEqual({ students: 0, completionRate: 0, revenue: [] });
  });

  it("reports zeros for a school without courses", () => {
    expect(summarizeCourseStats([])).toEqual({ students: 0, completionRate: 0, revenue: [] });
  });
});
