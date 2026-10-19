import type { CourseStats, Revenue } from "./ports";

/** A school's headline dashboard figures across all its courses. */
export interface StatsSummary {
  /** Paid students over every course. */
  students: number;
  /** Completions over students, 0 to 1; 0 when there are no students. */
  completionRate: number;
  /** One entry per currency, sorted by currency code; amounts in different currencies are never added together. */
  revenue: Revenue[];
}

/**
 * Totals per-course stats into the school's headline figures for the dashboard overview.
 *
 * @param courses The school's per-course stats.
 * @returns Total students, the overall completion rate and revenue per currency.
 * @example
 * const { students, completionRate, revenue } = summarizeCourseStats(await analytics.getCourseStats());
 */
export function summarizeCourseStats(courses: CourseStats[]): StatsSummary {
  const students = courses.reduce((sum, course) => sum + course.students, 0);
  const completions = courses.reduce((sum, course) => sum + course.completions, 0);
  const byCurrency = new Map<Revenue["currency"], number>();
  for (const { currency, amount } of courses.flatMap((course) => course.revenue)) {
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + amount);
  }
  return {
    students,
    completionRate: students === 0 ? 0 : completions / students,
    revenue: [...byCurrency]
      .map(([currency, amount]) => ({ currency, amount }))
      .toSorted((a, b) => a.currency.localeCompare(b.currency)),
  };
}
