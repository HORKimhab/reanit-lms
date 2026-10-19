import type { DbClient } from "./client";
import { forSchool } from "./tenant";

/** Currencies courses are sold in; matches `Currency` in `@reanit/core/commerce`. */
type Currency = "USD" | "KHR";

/**
 * One school's dashboard stats, summed from the daily stats tables (never from orders or progress).
 * Every query goes through the tenant client; it satisfies `StatsStore` from `@reanit/core/analytics`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school whose stats these are.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const analytics = createAnalyticsService({ store: createStatsStore(db, school.id) });
 */
export function createStatsStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  return {
    /**
     * Lists every course with its total students, completions and revenue per currency.
     *
     * @returns The courses, zeros included, revenue sorted by currency code.
     */
    async listCourseStats() {
      const [courses, sales, completions] = await Promise.all([
        tenant.course.findMany({ select: { id: true, title: true, slug: true } }),
        tenant.dailySales.groupBy({ by: ["courseId", "currency"], _sum: { sales: true, revenue: true }, orderBy: { currency: "asc" } }),
        tenant.dailyCompletions.groupBy({ by: ["courseId"], _sum: { completions: true } }),
      ]);
      return courses.map((course) => {
        const courseSales = sales.filter((row) => row.courseId === course.id);
        return {
          courseId: course.id,
          title: course.title,
          slug: course.slug,
          students: courseSales.reduce((total, row) => total + (row._sum.sales ?? 0), 0),
          completions: completions.find((row) => row.courseId === course.id)?._sum.completions ?? 0,
          revenue: courseSales.map((row) => ({ currency: row.currency as Currency, amount: Number(row._sum.revenue ?? 0) })),
        };
      });
    },
  };
}
