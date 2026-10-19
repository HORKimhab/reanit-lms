import type { DbClient } from "./client";
import { forSchool } from "./tenant";

/** Currencies courses are sold in; matches `Currency` in `@reanit/core/commerce`. */
type Currency = "USD" | "KHR";

/** The UTC days a report covers, both included; matches `DayRange` in `@reanit/core/analytics`. */
type DayRange = { from: Date; to: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Turns a range of whole days into the moments it spans, for timestamp columns.
 *
 * @param range The first and last day.
 * @param range.from Midnight UTC of the first day.
 * @param range.to Midnight UTC of the last day.
 * @returns A filter from the first day's start up to the end of the last day.
 */
function momentsOf({ from, to }: DayRange) {
  return { gte: from, lt: new Date(to.getTime() + DAY_MS) };
}

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

    /**
     * Lists the daily sales of the range's days, per course and currency.
     *
     * @param range The first and last day.
     * @returns The rows, with each course's title and slug.
     */
    async listDailySales(range: DayRange) {
      const rows = await tenant.dailySales.findMany({
        where: { day: { gte: range.from, lte: range.to } },
        orderBy: [{ day: "asc" }, { currency: "asc" }],
        select: { day: true, currency: true, sales: true, revenue: true, course: { select: { id: true, title: true, slug: true } } },
      });
      return rows.map((row) => ({ ...row, currency: row.currency as Currency, revenue: Number(row.revenue) }));
    },

    /**
     * Counts the orders paid on the range's days that were since refunded, per currency.
     *
     * @param range The first and last day.
     * @returns Each currency's refunded orders and amount, sorted by currency code.
     */
    async listRefunds(range: DayRange) {
      const rows = await tenant.order.groupBy({
        by: ["currency"],
        where: { status: "refunded", paidAt: momentsOf(range) },
        _count: { _all: true },
        _sum: { totalAmount: true },
        orderBy: { currency: "asc" },
      });
      return rows.map((row) => ({ currency: row.currency as Currency, amount: row._sum.totalAmount ?? 0, orders: row._count._all }));
    },

    /**
     * Describes how far each enrollment made on the range's days got through its course.
     *
     * @param range The first and last day.
     * @returns One entry per enrollment.
     */
    async listFunnelEntries(range: DayRange) {
      const enrollments = await tenant.enrollment.findMany({
        where: { createdAt: momentsOf(range) },
        select: { courseId: true, completedAt: true, progress: { select: { completedAt: true } } },
      });
      const courses = await tenant.course.findMany({
        where: { id: { in: [...new Set(enrollments.map(({ courseId }) => courseId))] } },
        select: { id: true, sections: { select: { _count: { select: { lessons: true } } } } },
      });
      const lessonsIn = new Map(courses.map(({ id, sections }) => [id, sections.reduce((total, section) => total + section._count.lessons, 0)]));
      return enrollments.map(({ courseId, completedAt, progress }) => ({
        isStarted: progress.length > 0,
        completedLessons: progress.filter((lesson) => lesson.completedAt !== null).length,
        totalLessons: lessonsIn.get(courseId) ?? 0,
        isCompleted: completedAt !== null,
      }));
    },
  };
}