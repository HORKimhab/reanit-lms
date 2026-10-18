import { useTranslations } from "next-intl";

import { StudentTable } from "@/components/dashboard/student-table";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { getMockStudents } from "@/mocks/students";

/**
 * Students list: everyone enrolled in the school's courses, newest first.
 *
 * @returns The page heading and the students table.
 */
export default function DashboardStudents() {
  const t = useTranslations("DashboardNav");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("students")}</h1>
      <StudentTable rows={getMockStudents(MOCK_SCHOOL_SLUG)} />
    </div>
  );
}
