import { useFormatter, useTranslations } from "next-intl";

import { Price } from "@/components/course/price";
import { useMoney } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { courseStats } from "@/mocks/courses";
import type { CourseSales } from "@/mocks/sales";

import { Cell, DataTable, EmptyState, RowHeader } from "./data-table";

/**
 * The creator's courses with price, lesson count, students and revenue.
 *
 * @param props - Component props.
 * @param props.caption - Accessible name of the table.
 * @param props.rows - Courses with their sales, in display order.
 * @returns A table with each title linking to its builder, or an empty state when there are no courses.
 */
export function CourseTable({ caption, rows }: { caption: string; rows: CourseSales[] }) {
  const t = useTranslations("Dashboard");
  const format = useFormatter();
  const money = useMoney();

  if (rows.length === 0) return <EmptyState title={t("emptyTitle")} text={t("emptyText")} />;

  return (
    <DataTable
      caption={caption}
      columns={[
        { label: t("course") },
        { label: t("price") },
        { label: t("lessons"), isNumeric: true },
        { label: t("students"), isNumeric: true },
        { label: t("revenue"), isNumeric: true },
      ]}
    >
      {rows.map(({ course, students, revenueMinor }) => (
        <tr key={course.slug}>
          <RowHeader>
            <Link href={`/dashboard/courses/${course.slug}`} className="hover:text-primary hover:underline">
              {course.title}
            </Link>
          </RowHeader>
          <Cell>
            <Price course={course} />
          </Cell>
          <Cell isNumeric>{format.number(courseStats(course).lessons)}</Cell>
          <Cell isNumeric>{format.number(students)}</Cell>
          <Cell isNumeric>{money(revenueMinor, course.currency)}</Cell>
        </tr>
      ))}
    </DataTable>
  );
}
