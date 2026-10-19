import type { CourseStats, StatsStore } from "./ports";

/** What `createAnalyticsService` needs. */
export interface AnalyticsDependencies {
  store: StatsStore;
}

/**
 * Builds one school's dashboard stats use cases. Figures come from pre-aggregated tables, never from
 * counting orders or progress rows.
 *
 * @param dependencies The stats store.
 * @param dependencies.store The school's daily stats.
 * @returns The stats operations.
 * @example
 * const analytics = createAnalyticsService({ store: createStatsStore(db, schoolId) });
 */
export function createAnalyticsService({ store }: AnalyticsDependencies) {
  return {
    /**
     * Lists every course with its students, completions and revenue, best sellers first.
     *
     * @returns The courses, by students descending, then by title.
     */
    async getCourseStats(): Promise<CourseStats[]> {
      return (await store.listCourseStats()).toSorted((a, b) => b.students - a.students || a.title.localeCompare(b.title));
    },
  };
}

/** One school's dashboard stats use cases. */
export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
