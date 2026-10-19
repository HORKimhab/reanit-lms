import { playerLessons, summarizeProgress } from "@reanit/core/learning";
import { getLocale, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/shells/empty-state";
import { redirect } from "@/i18n/navigation";
import { getPlayerCourse } from "@/server/learning/player";

/**
 * Sends the student to the lesson they should resume, or says the course has no lessons yet.
 * 404s when they are not enrolled.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain and the course slug.
 * @returns The empty-course notice; otherwise it redirects.
 */
export default async function ResumeCourse({ params }: PageProps<"/[locale]/s/[school]/learn/[course]">) {
  const { school, course: slug } = await params;
  const course = await getPlayerCourse(school, decodeURIComponent(slug));
  const { resume } = summarizeProgress(playerLessons(course, course.progress, new Date()));
  if (!resume) {
    const t = await getTranslations("Player");
    return <EmptyState title={t("emptyCourseTitle")} text={t("emptyCourseText")} />;
  }
  redirect({ href: `/s/${school}/learn/${course.slug}/${resume.id}`, locale: await getLocale() });
}
