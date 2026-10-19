import { playerLessons } from "@reanit/core/learning";
import { notFound } from "next/navigation";

import { completeLesson, saveVideoPosition } from "@/app/[locale]/s/[school]/learn/actions";
import { LessonView } from "@/components/player/lesson-view";
import { getLessonFileUrl, getPlayerCourse } from "@/server/learning/player";

/**
 * One lesson in the player, with its file signed for the student. 404s when the lesson is not in the course.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain, the course slug and the lesson id.
 * @returns The lesson view.
 * @throws {Error} Next's not-found signal when the student does not have the course or it has no such lesson.
 */
export default async function LessonPage({ params }: PageProps<"/[locale]/s/[school]/learn/[course]/[lesson]">) {
  const { school, course: slug, lesson: lessonId } = await params;
  const course = await getPlayerCourse(school, decodeURIComponent(slug));
  const lessons = playerLessons(course, course.progress);
  const lesson = lessons.find((candidate) => candidate.id === lessonId);
  if (!lesson) notFound();
  const base = `/s/${school}/learn/${course.slug}`;
  const next = lessons[lesson.index + 1];
  const fileUrl = lesson.type !== "text" && lesson.hasMedia ? await getLessonFileUrl(school, lesson.id, `${base}/${lesson.id}`) : null;
  return (
    <LessonView
      lessons={lessons}
      lesson={lesson}
      base={base}
      fileUrl={fileUrl}
      savePosition={saveVideoPosition.bind(null, school, lesson.id)}
      complete={completeLesson.bind(null, school, lesson.id, next ? `${base}/${next.id}` : `/s/${school}/my-courses`)}
    />
  );
}
