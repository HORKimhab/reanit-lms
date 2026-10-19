import type { CourseWithOutline } from "@reanit/core/catalog";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CourseBuilder } from "@/components/builder/course-builder";
import { CourseSettingsForm } from "@/components/builder/course-settings-form";
import { DeleteCourseButton } from "@/components/builder/delete-course-button";
import { Link } from "@/i18n/navigation";
import { getStaffCourse } from "@/server/catalog/courses";

import { attachLessonMedia, deleteCourse, saveOutline, startLessonUpload, updateCourse } from "../actions";

/**
 * Lists the lessons that already have a video or PDF.
 *
 * @param course - The course with its outline.
 * @returns Their ids.
 */
function lessonsWithMedia(course: CourseWithOutline): string[] {
  return course.sections.flatMap((section) => section.lessons.filter((lesson) => lesson.hasMedia).map((lesson) => lesson.id));
}

/**
 * Course editor for one of the school's courses: details, curriculum builder and delete.
 *
 * @param props - Page props.
 * @param props.params - Route params with the course slug.
 * @returns A link back to the course list, the details form, the builder and the delete button.
 * @throws {Error} Next's not-found signal when the school has no course with that slug.
 */
export default async function CourseBuilderPage({ params }: PageProps<"/[locale]/dashboard/courses/[course]">) {
  const { course: slug } = await params;
  const [t, form, course] = await Promise.all([
    getTranslations("Dashboard"),
    getTranslations("CourseForm"),
    getStaffCourse(decodeURIComponent(slug)),
  ]);
  const { sections, ...details } = course;

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/dashboard/courses"
        className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {t("allCourses")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{course.title}</h1>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{form("details")}</h2>
        <CourseSettingsForm course={details} action={updateCourse.bind(null, course.id)} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{form("curriculum")}</h2>
        <CourseBuilder
          initial={{ sections }}
          save={saveOutline.bind(null, course.id)}
          media={{ lessonsWithMedia: lessonsWithMedia(course), start: startLessonUpload, attach: attachLessonMedia }}
        />
      </section>
      <DeleteCourseButton action={deleteCourse.bind(null, course.id)} />
    </div>
  );
}
