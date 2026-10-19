import type { Clock } from "../auth";
import type { CourseStats, StatsStore } from "./ports";
import { buildSalesReport, resolveRange, type SalesQuery, type SalesReport } from "./sales";

/** What `createAnalyticsService` needs. */
export interface AnalyticsDependencies {
  store: StatsStore;
  /** The current time, for a report's default range. */
  clock: Clock;
}

/**
 * Builds one school's dashboard stats use cases. Sales figures come from pre-aggregated daily tables;
 * refunds and the completion funnel count only the orders and enrollments of the range asked for.
 *
 * @param dependencies The stats store and clock.
 * @param dependencies.store The school's daily stats.
 * @param dependencies.clock The current time.
 * @returns The stats operations.
 * @example
 * const analytics = createAnalyticsService({ store: createStatsStore(db, schoolId), clock });
 */
export function createAnalyticsService({ store, clock }: AnalyticsDependencies) {
  return {
    /**
     * Lists every course with its students, completions and revenue, best sellers first.
     *
     * @returns The courses, by students descending, then by title.
     */
    async getCourseStats(): Promise<CourseStats[]> {
      return (await store.listCourseStats()).toSorted((a, b) => b.students - a.students || a.title.localeCompare(b.title));
    },

    /**
     * Reports sales over a range of UTC days: revenue per day, course and currency, refunds, and how
     * far the range's new students got through their courses.
     *
     * @param query The first and last day; the last 30 days up to today when left out.
     * @returns The report.
     * @throws {InvalidStatsRangeError} When the range ends before it starts or covers more than a year.
     */
    async getSalesReport(query: SalesQuery): Promise<SalesReport> {
      const range = resolveRange(query, clock.now());
      const [rows, refunds, funnel] = await Promise.all([store.listDailySales(range), store.listRefunds(range), store.listFunnelEntries(range)]);
      return buildSalesReport({ range, rows, refunds, funnel });
    },
  };
}

/** One school's dashboard stats use cases. */
export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
