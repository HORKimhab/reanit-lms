import { beforeEach, describe, expect, it } from "vitest";

import { FakeStatsStore } from "../test/analytics-fakes";
import { FakeClock } from "../test/auth-fakes";
import { InvalidStatsRangeError } from "./errors";
import type { CourseStats } from "./ports";
import { createAnalyticsService, type AnalyticsService } from "./service";

const NOW = new Date("2026-10-20T15:00:00Z");

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

let store: FakeStatsStore;
let analytics: AnalyticsService;

beforeEach(() => {
  store = new FakeStatsStore();
  analytics = createAnalyticsService({ store, clock: new FakeClock(NOW) });
});

describe("getCourseStats", () => {
  it("lists the best-selling courses first, then by title", async () => {
    store.courses = [statsFor("B", 0), statsFor("C", 12), statsFor("A", 0)];

    expect((await analytics.getCourseStats()).map((course) => course.title)).toEqual(["C", "A", "B"]);
  });

  it("returns nothing for a school without courses", async () => {
    expect(await analytics.getCourseStats()).toEqual([]);
  });
});

describe("getSalesReport", () => {
  it("reports the last 30 days up to today by default, asking every query for that range", async () => {
    const report = await analytics.getSalesReport({});

    const range = { from: new Date("2026-09-21T00:00:00Z"), to: new Date("2026-10-20T00:00:00Z") };
    expect(report.range).toEqual(range);
    expect(report.daily).toHaveLength(30);
    expect(store.ranges).toEqual([range, range, range]);
  });

  it("builds the report from the range's sales, refunds and enrollments", async () => {
    const course = { id: "c1", title: "Brand", slug: "brand" };
    store.dailySales = [{ day: new Date("2026-10-02T00:00:00Z"), course, currency: "USD", sales: 2, revenue: 9800 }];
    store.refunds = [{ currency: "USD", amount: 4900, orders: 1 }];
    store.funnel = [{ isStarted: true, completedLessons: 1, totalLessons: 1, isCompleted: true }];

    const report = await analytics.getSalesReport({ from: "2026-10-01", to: "2026-10-03" });

    expect(report.totals).toEqual({ sales: 2, revenue: [{ currency: "USD", amount: 9800 }] });
    expect(report.refunds).toEqual([{ currency: "USD", amount: 4900, orders: 1 }]);
    expect(report.funnel).toEqual({ enrolled: 1, started: 1, halfway: 1, completed: 1 });
  });

  it("throws InvalidStatsRangeError for a range that ends before it starts", async () => {
    await expect(analytics.getSalesReport({ from: "2026-10-05", to: "2026-10-01" })).rejects.toThrow(InvalidStatsRangeError);
    expect(store.ranges).toEqual([]);
  });
});
