import type { CourseStats } from "@reanit/core/analytics";
import { useFormatter, useTranslations } from "next-intl";

import { CourseTitleCell, NoCoursesYet } from "./course-table";
import { Cell, DataTable } from "./data-table";
import { RevenueList } from "./revenue-list";

/**
 * Courses with their students, completions and revenue, for the sales overview.
 *
 * @param props - Component props.
 * @param props.caption - Accessible name of the table.
 * @param props.rows - Courses with their stats, in display order.
 * @returns A table with each title linking to its builder, or an empty state when there are no courses.
 */
export function CourseSalesTable({ caption, rows }: { caption: string; rows: CourseStats[] }) {
  const t = useTranslations("Dashboard");
  const format = useFormatter();

  if (rows.length === 0) return <NoCoursesYet />;

  return (
    <DataTable
      caption={caption}
      columns={[
        { label: t("course") },
        { label: t("students"), isNumeric: true },
        { label: t("completions"), isNumeric: true },
        { label: t("revenue"), isNumeric: true },
      ]}
    >
      {rows.map((course) => (
        <tr key={course.courseId}>
          <CourseTitleCell course={course} />
          <Cell isNumeric>{format.number(course.students)}</Cell>
          <Cell isNumeric>{format.number(course.completions)}</Cell>
          <Cell isNumeric>
            <RevenueList revenue={course.revenue} />
          </Cell>
        </tr>
      ))}
    </DataTable>
  );
}
