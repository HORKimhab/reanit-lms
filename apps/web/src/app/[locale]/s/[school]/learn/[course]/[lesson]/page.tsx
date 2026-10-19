import { playerLessons } from "@reanit/core/learning";
import { notFound } from "next/navigation";

import { completeLesson, saveVideoPosition, submitQuizAnswers } from "@/app/[locale]/s/[school]/learn/actions";
import { LessonView } from "@/components/player/lesson-view";
import { getLessonFileUrl, getPlayerCourse } from "@/server/learning/player";
import { getStudentQuiz } from "@/server/learning/quizzes";

/**
 * One lesson in the player, with its file signed or its quiz loaded for the student. 404s when the lesson is not in the course.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain, the course slug and the lesson id.
 * @returns The lesson view.
 * @throws {Error} Next's not-found signal when the student does not have the course or it has no such lesson.
 */
export default async function LessonPage({ params }: PageProps<"/[locale]/s/[school]/learn/[course]/[lesson]">) {
  const { school, course: slug, lesson: lessonId } = await params;
  const course = await getPlayerCourse(school, decodeURIComponent(slug));
  const lessons = playerLessons(course, course.progress, new Date());
  const lesson = lessons.find((candidate) => candidate.id === lessonId);
  if (!lesson) notFound();
  const base = `/s/${school}/learn/${course.slug}`;
  const next = lessons[lesson.index + 1];
  const nextHref = next ? `${base}/${next.id}` : `/s/${school}/my-courses`;
  const lessonPath = `${base}/${lesson.id}`;
  // A drip lesson not open yet has nothing to load: the API refuses its file and quiz until it opens.
  const isOpen = lesson.lockedUntil === null;
  const fileUrl = isOpen && lesson.type !== "text" && lesson.hasMedia ? await getLessonFileUrl(school, lesson.id, lessonPath) : null;
  const quiz =
    isOpen && lesson.type === "quiz"
      ? { view: await getStudentQuiz(school, lesson.id, lessonPath), submit: submitQuizAnswers.bind(null, school, lesson.id) }
      : null;
  return (
    <LessonView
      lessons={lessons}
      lesson={lesson}
      base={base}
      fileUrl={fileUrl}
      quiz={quiz}
      nextHref={nextHref}
      savePosition={saveVideoPosition.bind(null, school, lesson.id)}
      complete={completeLesson.bind(null, school, lesson.id, nextHref)}
    />
  );
}
