import type { Course } from "@reanit/core/catalog";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { EmptyState } from "@/components/shells/empty-state";

import { Cell, DataTable, RowHeader } from "./data-table";
import { StatusBadge } from "./status-badge";

/**
 * The creator's courses with their publishing status.
 *
 * @param props - Component props.
 * @param props.caption - Accessible name of the table.
 * @param props.courses - The school's courses, in display order.
 * @returns A table with each title linking to its builder, or an empty state when there are no courses.
 */
export function CourseTable({ caption, courses }: { caption: string; courses: Course[] }) {
  const t = useTranslations("Dashboard");

  if (courses.length === 0) return <NoCoursesYet />;

  return (
    <DataTable caption={caption} columns={[{ label: t("course") }, { label: t("status") }]}>
      {courses.map((course) => (
        <tr key={course.id}>
          <CourseTitleCell course={course} />
          <Cell>
            <StatusBadge status={course.status} />
          </Cell>
        </tr>
      ))}
    </DataTable>
  );
}

/**
 * Empty state shown instead of a course table when the school has no courses.
 *
 * @returns The empty state.
 */
export function NoCoursesYet() {
  const t = useTranslations("Dashboard");
  return <EmptyState title={t("emptyTitle")} text={t("emptyText")} />;
}

/**
 * A course table's row header: the title, linking to the course's builder.
 *
 * @param props - Component props.
 * @param props.course - The course.
 * @param props.course.slug - Its URL slug.
 * @param props.course.title - Its title.
 * @returns The row header cell.
 */
export function CourseTitleCell({ course }: { course: { slug: string; title: string } }) {
  return (
    <RowHeader>
      <Link href={`/dashboard/courses/${course.slug}`} className="hover:text-primary hover:underline">
        {course.title}
      </Link>
    </RowHeader>
  );
}
