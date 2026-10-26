import type { CourseWithOutline } from "@reanit/core/catalog";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CourseBuilder } from "@/components/builder/course-builder";
import { CourseSettingsForm } from "@/components/builder/course-settings-form";
import { ConfirmButton } from "@/components/form/confirm-button";
import { PriceForm } from "@/components/pricing/price-form";
import { Link } from "@/i18n/navigation";
import { getStaffCourse } from "@/server/catalog/courses";
import { getCoursePrice } from "@/server/commerce/prices";
import { canManageSchool, getStaffSchool } from "@/server/schools/staff";

import { attachLessonMedia, deleteCourse, saveOutline, setCoursePrice, startLessonUpload, updateCourse } from "../actions";

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
 * Course editor for one of the school's courses: details, price (for owners and admins), curriculum builder and delete.
 *
 * @param props - Page props.
 * @param props.params - Route params with the course slug.
 * @returns A link back to the course list, the details form, the price form, the builder and the delete button.
 * @throws {Error} Next's not-found signal when the school has no course with that slug.
 */
export default async function CourseBuilderPage({ params }: PageProps<"/[locale]/dashboard/courses/[course]">) {
  const { course: slug } = await params;
  const [t, form, pricing, course, { role }] = await Promise.all([
    getTranslations("Dashboard"),
    getTranslations("CourseForm"),
    getTranslations("Pricing"),
    getStaffCourse(decodeURIComponent(slug)),
    getStaffSchool(),
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
        <h2 className="text-lg font-semibold">{pricing("title")}</h2>
        {canManageSchool(role) ? (
          <PriceForm price={await getCoursePrice(course.id)} action={setCoursePrice.bind(null, course.id)} />
        ) : (
          <p className="text-sm text-muted-foreground">{pricing("staffOnly")}</p>
        )}
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{form("curriculum")}</h2>
        <CourseBuilder
          initial={{ sections }}
          save={saveOutline.bind(null, course.id)}
          media={{ lessonsWithMedia: lessonsWithMedia(course), start: startLessonUpload, attach: attachLessonMedia }}
          quizBase={`/dashboard/courses/${course.slug}/quizzes`}
        />
      </section>
      <ConfirmButton
        action={deleteCourse.bind(null, course.id)}
        labels={{
          trigger: form("delete"),
          warning: form("deleteWarning"),
          confirm: form("confirmDelete"),
          pending: form("deleting"),
          cancel: form("cancel"),
        }}
      />
    </div>
  );
}
