import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { getMockEnrollment, getResumeLesson } from "@/mocks/enrollments";

/**
 * Sends the student to the lesson they should resume. 404s when not enrolled or the course is empty.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school and course slugs.
 * @returns Never; it always redirects or 404s.
 */
export default async function ResumeCourse({ params }: PageProps<"/[locale]/s/[school]/learn/[course]">) {
  const { school, course } = await params;
  const enrollment = getMockEnrollment(school, course);
  const lesson = enrollment && getResumeLesson(enrollment);
  if (!lesson) notFound();
  redirect({ href: `/s/${school}/learn/${course}/${lesson.id}`, locale: await getLocale() });
}
