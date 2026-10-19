import { getTranslations } from "next-intl/server";

import { StudentList } from "@/components/dashboard/student-list";
import { listStudents, studentSearchFrom } from "@/server/schools/students";

/**
 * Students list: everyone enrolled in the school's courses, newest first, searchable and paged.
 *
 * @param props - Page props.
 * @param props.searchParams - `q` (name or email search) and `page` (1-based).
 * @returns The page heading and the students list.
 */
export default async function DashboardStudents({ searchParams }: PageProps<"/[locale]/dashboard/students">) {
  const search = studentSearchFrom(await searchParams);
  const [t, result] = await Promise.all([getTranslations("DashboardNav"), listStudents(search)]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("students")}</h1>
      <StudentList result={result} q={search.q} />
    </div>
  );
}
