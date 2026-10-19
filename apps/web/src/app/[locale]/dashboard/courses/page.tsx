import { getTranslations } from "next-intl/server";

import { NewCourseForm } from "@/components/builder/new-course-form";
import { CourseTable } from "@/components/dashboard/course-table";
import { listStaffCourses } from "@/server/catalog/courses";

import { createCourse } from "./actions";

/**
 * Dashboard course list: a form to start a course, then every course in the school.
 *
 * @returns The page heading, the new-course form and the course table.
 */
export default async function DashboardCourses() {
  const [t, nav, courses] = await Promise.all([
    getTranslations("Dashboard"),
    getTranslations("DashboardNav"),
    listStaffCourses(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{nav("courses")}</h1>
      <NewCourseForm action={createCourse} />
      <CourseTable caption={t("allCourses")} courses={courses} />
    </div>
  );
}
