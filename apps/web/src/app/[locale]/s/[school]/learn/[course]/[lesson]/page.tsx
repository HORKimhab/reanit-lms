import { notFound } from "next/navigation";
import { use } from "react";

import { LessonView } from "@/components/player/lesson-view";
import { flattenLessons } from "@/mocks/courses";
import { getMockEnrollment } from "@/mocks/enrollments";

/**
 * One lesson in the player. 404s when the student is not enrolled or the lesson does not exist.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school, course and lesson.
 * @returns The lesson view.
 * @throws {Error} Next's not-found signal when the student is not enrolled or the lesson does not exist.
 */
export default function LessonPage({ params }: PageProps<"/[locale]/s/[school]/learn/[course]/[lesson]">) {
  const { school, course: slug, lesson: lessonId } = use(params);
  const enrollment = getMockEnrollment(school, slug);
  const lessons = enrollment ? flattenLessons(enrollment.course) : [];
  const lesson = lessons.find((l) => l.id === lessonId);
  if (!enrollment || !lesson) notFound();
  return <LessonView school={school} courseSlug={slug} lessons={lessons} lesson={lesson} />;
}
