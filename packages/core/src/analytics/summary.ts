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
  return {
    students,
    completionRate: students === 0 ? 0 : completions / students,
    revenue: sumByCurrency(courses.flatMap((course) => course.revenue)),
  };
}

/**
 * Adds amounts up per currency; amounts in different currencies are never added together.
 *
 * @param amounts Amounts in any currencies.
 * @returns One total per currency, sorted by currency code.
 * @example
 * sumByCurrency([{ currency: "USD", amount: 100 }, { currency: "USD", amount: 50 }]); // [{ currency: "USD", amount: 150 }]
 */
export function sumByCurrency(amounts: readonly Revenue[]): Revenue[] {
  const byCurrency = new Map<Revenue["currency"], number>();
  for (const { currency, amount } of amounts) byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + amount);
  return [...byCurrency].map(([currency, amount]) => ({ currency, amount })).toSorted((a, b) => a.currency.localeCompare(b.currency));
}
