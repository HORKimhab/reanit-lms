import { getMockCourse, type MockCourse } from "./courses";
import { MOCK_SCHOOL_SLUG } from "./schools";

// Mock per-course sales until API-07 (pre-aggregated dashboard stats) lands.
// Revenue is in the course's own currency: students × price.
const SALES = [
  { schoolSlug: MOCK_SCHOOL_SLUG, courseSlug: "brand-design-basics", students: 128, revenueMinor: 627200, completions: 41 },
  { schoolSlug: MOCK_SCHOOL_SLUG, courseSlug: "social-media-content", students: 54, revenueMinor: 648000000, completions: 22 },
  // Another school reusing a course slug: its sales must never show up in the mock school's dashboard.
  { schoolSlug: "other-school", courseSlug: "brand-design-basics", students: 7, revenueMinor: 34300, completions: 1 },
];

/** One course's sales figures for the creator dashboard. */
export type CourseSales = {
  course: MockCourse;
  /** Students enrolled through a paid checkout. */
  students: number;
  /** Total paid, in minor units of `course.currency`. */
  revenueMinor: number;
  /** Students who finished every lesson. */
  completions: number;
};

/** Revenue in one currency; amounts in different currencies are never added together. */
type Revenue = { currency: MockCourse["currency"]; amountMinor: number };

/** A school's totals across all its courses. */
export type SalesSummary = {
  students: number;
  /** Completions over students, 0 to 1. */
  completionRate: number;
  /** One entry per currency, sorted by currency code. */
  revenue: Revenue[];
};

/**
 * Lists a school's per-course sales, most students first.
 *
 * @param schoolSlug - The school's slug.
 * @returns The courses with their sales, empty when the school has none. Never another school's.
 */
export function getMockCourseSales(schoolSlug: string): CourseSales[] {
  return SALES.filter((s) => s.schoolSlug === schoolSlug)
    .flatMap(({ courseSlug, students, revenueMinor, completions }) => {
      const course = getMockCourse(schoolSlug, courseSlug);
      return course ? [{ course, students, revenueMinor, completions }] : [];
    })
    .sort((a, b) => b.students - a.students);
}

/**
 * Totals per-course sales into the dashboard's headline figures.
 *
 * @param sales - The school's per-course sales.
 * @returns Total students, overall completion rate (0 when there are no students) and revenue per currency.
 */
export function summarizeSales(sales: CourseSales[]): SalesSummary {
  const students = sales.reduce((sum, s) => sum + s.students, 0);
  const completions = sales.reduce((sum, s) => sum + s.completions, 0);
  const byCurrency = new Map<Revenue["currency"], number>();
  for (const { course, revenueMinor } of sales) {
    byCurrency.set(course.currency, (byCurrency.get(course.currency) ?? 0) + revenueMinor);
  }
  return {
    students,
    completionRate: students === 0 ? 0 : completions / students,
    revenue: [...byCurrency]
      .map(([currency, amountMinor]) => ({ currency, amountMinor }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}
