import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { QuizEditor } from "@/components/builder/quiz-editor";
import { Link } from "@/i18n/navigation";
import { getStaffCourse } from "@/server/catalog/courses";
import { getStaffQuiz } from "@/server/learning/quizzes";

import { saveQuiz } from "../../../actions";

/**
 * Quiz editor for one quiz lesson of a course. 404s when the course has no such lesson or it is not a quiz.
 *
 * @param props - Page props.
 * @param props.params - Route params with the course slug and the lesson id.
 * @returns A link back to the course, the lesson's title and the quiz editor.
 * @throws {Error} Next's not-found signal for an unknown course, lesson or a lesson that is not a quiz.
 */
export default async function QuizEditorPage({ params }: PageProps<"/[locale]/dashboard/courses/[course]/quizzes/[lesson]">) {
  const { course: slug, lesson: lessonId } = await params;
  const course = await getStaffCourse(decodeURIComponent(slug));
  const lesson = course.sections.flatMap((section) => section.lessons).find((candidate) => candidate.id === lessonId);
  if (!lesson) notFound();
  const [t, quiz] = await Promise.all([getTranslations("Quiz"), getStaffQuiz(lesson.id)]);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/dashboard/courses/${course.slug}`} className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        {t("backToCourse")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{t("editorTitle", { title: lesson.title })}</h1>
      <QuizEditor initial={quiz} save={saveQuiz.bind(null, lesson.id)} />
    </div>
  );
}
