import { summarizeCourseStats, type CourseStats } from "@reanit/core/analytics";
import { useFormatter, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { CourseSalesTable } from "./course-sales-table";
import { RevenueList } from "./revenue-list";
import { StatTile } from "./stat-tile";

const TOP_COURSES = 3;

/**
 * Dashboard overview: headline revenue, students and completion rate, then the top courses.
 *
 * @param props - Component props.
 * @param props.stats - The school's per-course stats, best sellers first.
 * @returns The stat tiles and the top-courses table with a link to the full list.
 */
export function SalesOverview({ stats }: { stats: CourseStats[] }) {
  const t = useTranslations("Dashboard");
  const nav = useTranslations("DashboardNav");
  const format = useFormatter();
  const summary = summarizeCourseStats(stats);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{nav("overview")}</h1>
      <dl className="grid gap-4 sm:grid-cols-3">
        <StatTile label={t("revenue")}>
          <RevenueList revenue={summary.revenue} />
        </StatTile>
        <StatTile label={t("students")}>{format.number(summary.students)}</StatTile>
        <StatTile label={t("completionRate")}>
          {format.number(summary.completionRate, { style: "percent", maximumFractionDigits: 0 })}
        </StatTile>
      </dl>
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-medium">{t("topCourses")}</h2>
          <Link href="/dashboard/courses" className="text-sm text-primary hover:underline">
            {t("viewAll")}
          </Link>
        </div>
        <CourseSalesTable caption={t("topCourses")} rows={stats.slice(0, TOP_COURSES)} />
      </section>
    </div>
  );
}
