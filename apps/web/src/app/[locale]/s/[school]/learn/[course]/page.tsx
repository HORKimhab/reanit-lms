import { playerLessons, summarizeProgress } from "@reanit/core/learning";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { getPlayerCourse } from "@/server/learning/player";

/**
 * Sends the student to the lesson they should resume. 404s when not enrolled or the course is empty.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain and the course slug.
 * @returns Never; it always redirects or 404s.
 */
export default async function ResumeCourse({ params }: PageProps<"/[locale]/s/[school]/learn/[course]">) {
  const { school, course: slug } = await params;
  const course = await getPlayerCourse(school, decodeURIComponent(slug));
  const { resume } = summarizeProgress(playerLessons(course, course.progress));
  if (!resume) notFound();
  redirect({ href: `/s/${school}/learn/${course.slug}/${resume.id}`, locale: await getLocale() });
}
