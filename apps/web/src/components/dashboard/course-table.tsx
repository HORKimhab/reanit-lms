import { useFormatter, useTranslations } from "next-intl";

import { Price } from "@/components/course/price";
import { useMoney } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { courseStats } from "@/mocks/courses";
import type { CourseSales } from "@/mocks/sales";

/**
 * The creator's courses with price, lesson count, students and revenue.
 *
 * @param props - Component props.
 * @param props.caption - Accessible name of the table.
 * @param props.rows - Courses with their sales, in display order.
 * @returns A scrollable table with each title linking to its builder, or an empty state when there are no courses.
 */
export function CourseTable({ caption, rows }: { caption: string; rows: CourseSales[] }) {
  const t = useTranslations("Dashboard");
  const format = useFormatter();
  const money = useMoney();

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
        <p className="font-medium">{t("emptyTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("emptyText")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">{t("course")}</th>
            <th scope="col" className="px-4 py-3 font-medium">{t("price")}</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">{t("lessons")}</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">{t("students")}</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">{t("revenue")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ course, students, revenueMinor }) => (
            <tr key={course.slug}>
              <th scope="row" className="px-4 py-3 text-left font-medium">
                <Link href={`/dashboard/courses/${course.slug}`} className="hover:text-primary hover:underline">
                  {course.title}
                </Link>
              </th>
              <td className="px-4 py-3">
                <Price course={course} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{format.number(courseStats(course).lessons)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{format.number(students)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{money(revenueMinor, course.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
