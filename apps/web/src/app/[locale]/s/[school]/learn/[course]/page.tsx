import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { flattenLessons } from "@/mocks/courses";
import { getMockEnrollment } from "@/mocks/enrollments";

// /learn/[course] resumes at the first unfinished lesson (or the last one if all are done).
export default async function ResumeCourse({ params }: { params: Promise<{ school: string; course: string }> }) {
  const { school, course } = await params;
  const enrollment = getMockEnrollment(school, course);
  if (!enrollment) notFound();
  const lessons = flattenLessons(enrollment.course);
  const next = lessons[Math.min(enrollment.completedLessons, lessons.length - 1)]!;
  redirect({ href: `/s/${school}/learn/${course}/${next.id}`, locale: await getLocale() });
}
