import { useFormatter, useTranslations } from "next-intl";

import type { StudentSummary } from "@/mocks/students";

import { Cell, DataTable, EmptyState, RowHeader } from "./data-table";

// Join dates are calendar dates, so format them in UTC to keep the same day in every time zone.
const CALENDAR_TIME_ZONE = "UTC";

/**
 * The school's students with their email, course counts and join date.
 *
 * @param props - Component props.
 * @param props.rows - Students, in display order.
 * @returns A table of students, or an empty state when there are none.
 */
export function StudentTable({ rows }: { rows: StudentSummary[] }) {
  const t = useTranslations("Students");
  const format = useFormatter();

  if (rows.length === 0) return <EmptyState title={t("emptyTitle")} text={t("emptyText")} />;

  return (
    <DataTable
      caption={t("caption")}
      columns={[
        { label: t("student") },
        { label: t("email") },
        { label: t("courses"), isNumeric: true },
        { label: t("completed"), isNumeric: true },
        { label: t("joined") },
      ]}
    >
      {rows.map((student) => (
        <tr key={student.id}>
          <RowHeader>{student.name}</RowHeader>
          <Cell>{student.email}</Cell>
          <Cell isNumeric>{format.number(student.courses)}</Cell>
          <Cell isNumeric>{format.number(student.completedCourses)}</Cell>
          <Cell>{format.dateTime(new Date(student.joinedOn), { dateStyle: "medium", timeZone: CALENDAR_TIME_ZONE })}</Cell>
        </tr>
      ))}
    </DataTable>
  );
}
