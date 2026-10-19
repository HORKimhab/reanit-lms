import { describe, expect, it } from "vitest";

import type { CourseStats, StatsStore } from "./ports";
import { createAnalyticsService } from "./service";

/**
 * Builds a course's stats with the given students.
 *
 * @param title The course's title.
 * @param students Its paid students.
 * @returns The stats.
 */
function statsFor(title: string, students: number): CourseStats {
  return { courseId: title, title, slug: title, students, completions: 0, revenue: [] };
}

/**
 * Creates a store that lists the given stats.
 *
 * @param stats What `listCourseStats` returns.
 * @returns The store.
 */
function storeListing(stats: CourseStats[]): StatsStore {
  return {
    /**
     * Lists the given stats.
     *
     * @returns `stats`.
     */
    async listCourseStats() {
      return stats;
    },
  };
}

describe("getCourseStats", () => {
  it("lists the best-selling courses first, then by title", async () => {
    const analytics = createAnalyticsService({ store: storeListing([statsFor("B", 0), statsFor("C", 12), statsFor("A", 0)]) });

    expect((await analytics.getCourseStats()).map((course) => course.title)).toEqual(["C", "A", "B"]);
  });

  it("returns nothing for a school without courses", async () => {
    expect(await createAnalyticsService({ store: storeListing([]) }).getCourseStats()).toEqual([]);
  });
});
