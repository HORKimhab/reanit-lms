import { useTranslations } from "next-intl";

import { CourseTable } from "@/components/dashboard/course-table";
import { getMockCourseSales } from "@/mocks/sales";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";

/**
 * Dashboard course list: every course in the school with its price and sales.
 *
 * @returns The page heading and the course table.
 */
export default function DashboardCourses() {
  const t = useTranslations("Dashboard");
  const nav = useTranslations("DashboardNav");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{nav("courses")}</h1>
      <CourseTable caption={t("allCourses")} rows={getMockCourseSales(MOCK_SCHOOL_SLUG)} />
    </div>
  );
}
