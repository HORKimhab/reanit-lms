import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { use } from "react";

import { CourseBuilder } from "@/components/builder/course-builder";
import { Link } from "@/i18n/navigation";
import { getMockCourse } from "@/mocks/courses";
import { getMockOutline } from "@/mocks/outline";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";

import { saveCourseOutline } from "./actions";

/**
 * Course builder page for one of the school's courses.
 *
 * @param props - Page props.
 * @param props.params - Route params with the course slug.
 * @returns A link back to the course list, the course title and the builder.
 * @throws {Error} Next's not-found signal when the school has no course with that slug.
 */
export default function CourseBuilderPage({ params }: PageProps<"/[locale]/dashboard/courses/[course]">) {
  const { course: slug } = use(params);
  const t = useTranslations("Dashboard");
  const course = getMockCourse(MOCK_SCHOOL_SLUG, slug);
  const outline = getMockOutline(MOCK_SCHOOL_SLUG, slug);
  if (!course || !outline) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/courses"
        className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {t("allCourses")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{course.title}</h1>
      <CourseBuilder initial={outline} save={saveCourseOutline.bind(null, slug)} />
    </div>
  );
}
