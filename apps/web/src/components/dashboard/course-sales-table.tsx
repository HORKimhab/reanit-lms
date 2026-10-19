import { useFormatter, useTranslations } from "next-intl";

import { Price } from "@/components/course/price";
import { useMoney } from "@/i18n/format";
import { courseStats } from "@/mocks/courses";
import type { CourseSales } from "@/mocks/sales";

import { CourseTitleCell, NoCoursesYet } from "./course-table";
import { Cell, DataTable } from "./data-table";

/**
 * Courses with price, lesson count, students and revenue, for the sales overview (mock data until API-07).
 *
 * @param props - Component props.
 * @param props.caption - Accessible name of the table.
 * @param props.rows - Courses with their sales, in display order.
 * @returns A table with each title linking to its builder, or an empty state when there are no courses.
 */
export function CourseSalesTable({ caption, rows }: { caption: string; rows: CourseSales[] }) {
  const t = useTranslations("Dashboard");
  const format = useFormatter();
  const money = useMoney();

  if (rows.length === 0) return <NoCoursesYet />;

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
          <CourseTitleCell course={course} />
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
