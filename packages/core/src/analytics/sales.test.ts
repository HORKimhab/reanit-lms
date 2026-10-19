import { describe, expect, it } from "vitest";

import { InvalidStatsRangeError } from "./errors";
import { buildSalesReport, completionFunnel, MAX_RANGE_DAYS, resolveRange, salesQuerySchema, type DailySale } from "./sales";

/**
 * Gives midnight UTC of a day.
 *
 * @param iso The day, `YYYY-MM-DD`.
 * @returns The moment.
 */
function DAY(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}
const BRAND = { id: "c1", title: "Brand", slug: "brand" };
const LOGO = { id: "c2", title: "Logo", slug: "logo" };

describe("resolveRange", () => {
  it("covers the 30 UTC days up to today by default", () => {
    expect(resolveRange({}, new Date("2026-10-20T23:30:00Z"))).toEqual({ from: DAY("2026-09-21"), to: DAY("2026-10-20") });
  });

  it("counts 30 days back from a last day given alone", () => {
    expect(resolveRange({ to: "2026-03-01" }, new Date())).toEqual({ from: DAY("2026-01-31"), to: DAY("2026-03-01") });
  });

  it("covers a single day, and a whole leap year", () => {
    expect(resolveRange({ from: "2026-10-01", to: "2026-10-01" }, new Date())).toEqual({ from: DAY("2026-10-01"), to: DAY("2026-10-01") });
    expect(() => resolveRange({ from: "2028-01-01", to: "2028-12-31" }, new Date())).not.toThrow();
  });

  it.each([
    ["ends before it starts", { from: "2026-10-02", to: "2026-10-01" }],
    [`covers more than ${MAX_RANGE_DAYS} days`, { from: "2026-01-01", to: "2027-01-02" }],
  ])("throws InvalidStatsRangeError for a range that %s", (_case, query) => {
    expect(() => resolveRange(query, new Date())).toThrow(InvalidStatsRangeError);
  });
});

describe("salesQuerySchema", () => {
  it("takes UTC days and refuses anything else", () => {
    expect(salesQuerySchema.parse({ from: "2026-10-01" })).toEqual({ from: "2026-10-01" });
    expect(salesQuerySchema.safeParse({ from: "2026-10-01T00:00:00Z" }).success).toBe(false);
    expect(salesQuerySchema.safeParse({ to: "yesterday" }).success).toBe(false);
  });
});

describe("buildSalesReport", () => {
  const ROWS: DailySale[] = [
    // The smaller seller comes first, so the report has to sort.
    { day: DAY("2026-10-01"), course: LOGO, currency: "KHR", sales: 1, revenue: 2_000_000 },
    { day: DAY("2026-10-01"), course: BRAND, currency: "USD", sales: 1, revenue: 4900 },
    { day: DAY("2026-10-03"), course: BRAND, currency: "USD", sales: 2, revenue: 9800 },
  ];
  const report = buildSalesReport({ range: { from: DAY("2026-10-01"), to: DAY("2026-10-03") }, rows: ROWS, refunds: [], funnel: [] });

  it("lists every day of the range with zeros in each currency sold on days without sales", () => {
    expect(report.daily).toEqual([
      { day: DAY("2026-10-01"), sales: 2, revenue: [{ currency: "KHR", amount: 2_000_000 }, { currency: "USD", amount: 4900 }] },
      { day: DAY("2026-10-02"), sales: 0, revenue: [{ currency: "KHR", amount: 0 }, { currency: "USD", amount: 0 }] },
      { day: DAY("2026-10-03"), sales: 2, revenue: [{ currency: "KHR", amount: 0 }, { currency: "USD", amount: 9800 }] },
    ]);
  });

  it("adds sales up per course, best-selling first, never mixing currencies", () => {
    expect(report.byCourse).toEqual([
      { courseId: "c1", title: "Brand", slug: "brand", sales: 3, revenue: [{ currency: "USD", amount: 14_700 }] },
      { courseId: "c2", title: "Logo", slug: "logo", sales: 1, revenue: [{ currency: "KHR", amount: 2_000_000 }] },
    ]);
    expect(report.totals).toEqual({ sales: 4, revenue: [{ currency: "KHR", amount: 2_000_000 }, { currency: "USD", amount: 14_700 }] });
  });

  it("reports empty days and no courses for a range without sales", () => {
    const empty = buildSalesReport({ range: { from: DAY("2026-10-01"), to: DAY("2026-10-02") }, rows: [], refunds: [], funnel: [] });

    expect(empty.daily).toEqual([
      { day: DAY("2026-10-01"), sales: 0, revenue: [] },
      { day: DAY("2026-10-02"), sales: 0, revenue: [] },
    ]);
    expect(empty.byCourse).toEqual([]);
  });
});

describe("completionFunnel", () => {
  it("counts students who started, got halfway and completed", () => {
    expect(
      completionFunnel([
        { isStarted: false, completedLessons: 0, totalLessons: 4, isCompleted: false },
        { isStarted: true, completedLessons: 1, totalLessons: 4, isCompleted: false },
        { isStarted: true, completedLessons: 2, totalLessons: 4, isCompleted: false },
        { isStarted: true, completedLessons: 4, totalLessons: 4, isCompleted: true },
      ]),
    ).toEqual({ enrolled: 4, started: 3, halfway: 2, completed: 1 });
  });

  it("counts a completed course as halfway even when it has no lessons left, and an empty course as not halfway", () => {
    expect(
      completionFunnel([
        { isStarted: false, completedLessons: 0, totalLessons: 0, isCompleted: true },
        { isStarted: false, completedLessons: 0, totalLessons: 0, isCompleted: false },
      ]),
    ).toEqual({ enrolled: 2, started: 0, halfway: 1, completed: 1 });
  });
});
