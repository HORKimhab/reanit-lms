import type { StudentSummary } from "@reanit/core/schools";
import { useFormatter, useTranslations } from "next-intl";

import { Cell, DataTable, RowHeader } from "./data-table";

// Server and browser format the join day in the same zone, so the date never shifts between them.
const JOIN_TIME_ZONE = "UTC";

/**
 * The school's students with their email, course counts and join date.
 *
 * @param props - Component props.
 * @param props.rows - Students, in display order; render an empty state instead when there are none.
 * @returns A table of students.
 */
export function StudentTable({ rows }: { rows: StudentSummary[] }) {
  const t = useTranslations("Students");
  const format = useFormatter();

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
          <RowHeader>{student.name ?? <span className="text-muted-foreground">{t("noName")}</span>}</RowHeader>
          <Cell>{student.email}</Cell>
          <Cell isNumeric>{format.number(student.courses)}</Cell>
          <Cell isNumeric>{format.number(student.completedCourses)}</Cell>
          <Cell>{format.dateTime(student.joinedAt, { dateStyle: "medium", timeZone: JOIN_TIME_ZONE })}</Cell>
        </tr>
      ))}
    </DataTable>
  );
}
