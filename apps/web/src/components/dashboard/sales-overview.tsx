import { useFormatter, useTranslations } from "next-intl";

import { useMoney } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { summarizeSales, type CourseSales } from "@/mocks/sales";

import { CourseTable } from "./course-table";
import { StatTile } from "./stat-tile";

const TOP_COURSES = 3;

/**
 * Dashboard overview: headline revenue, students and completion rate, then the top courses.
 *
 * @param props - Component props.
 * @param props.sales - The school's per-course sales, most students first.
 * @returns The stat tiles and the top-courses table with a link to the full list.
 */
export function SalesOverview({ sales }: { sales: CourseSales[] }) {
  const t = useTranslations("Dashboard");
  const nav = useTranslations("DashboardNav");
  const format = useFormatter();
  const money = useMoney();
  const summary = summarizeSales(sales);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{nav("overview")}</h1>
      <dl className="grid gap-4 sm:grid-cols-3">
        <StatTile label={t("revenue")}>
          {summary.revenue.length === 0
            ? t("noSales")
            : summary.revenue.map((r) => <span key={r.currency}>{money(r.amountMinor, r.currency)}</span>)}
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
        <CourseTable caption={t("topCourses")} rows={sales.slice(0, TOP_COURSES)} />
      </section>
    </div>
  );
}
