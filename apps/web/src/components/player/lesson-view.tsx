import type { CommentThread, PlayerLesson, QuizAnswers, QuizResult } from "@reanit/core/learning";
import { Button } from "@reanit/ui/components/button";
import { ArrowLeft, ArrowRight, Download, FileText, Lock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { StudentQuizView } from "@/server/learning/quizzes";

import { LessonComments, type LessonCommentActions } from "./lesson-comments";
import { LessonVideo } from "./lesson-video";
import { QuizPlayer } from "./quiz-player";

/** A quiz lesson's quiz and how its answers are graded. */
type LessonQuiz = { view: StudentQuizView | null; submit: (answers: QuizAnswers) => Promise<QuizResult> };

/**
 * One lesson in the player: content, position in the course, and previous / complete-and-continue navigation.
 * A quiz lesson is completed by passing it, so it offers "continue" only once passed; a drip lesson
 * not open yet shows when it opens instead of its content, and cannot be completed.
 *
 * @param props - Component props.
 * @param props.lessons - Every lesson in the course, in order.
 * @param props.lesson - The lesson to show; one of `lessons`.
 * @param props.base - The course's player path.
 * @param props.fileUrl - Signed URL of the lesson's video or PDF; null for text lessons and files not uploaded yet.
 * @param props.quiz - The quiz of a quiz lesson; null for other lessons.
 * @param props.comments - The lesson's comments with the signed-in student and the comment actions; null while the lesson is closed.
 * @param props.nextHref - Where the student goes after this lesson.
 * @param props.savePosition - The video heartbeat, bound to the lesson.
 * @param props.complete - Marks the lesson completed and moves on, bound to the lesson and the next page.
 * @returns The lesson's content, title and position, and links to the previous and next lessons.
 */
export function LessonView({
  lessons,
  lesson,
  base,
  fileUrl,
  quiz,
  comments,
  nextHref,
  savePosition,
  complete,
}: {
  lessons: PlayerLesson[];
  lesson: PlayerLesson;
  base: string;
  fileUrl: string | null;
  quiz: LessonQuiz | null;
  comments: { threads: CommentThread[]; userId: string; actions: LessonCommentActions } | null;
  nextHref: string;
  savePosition: (positionSeconds: number) => Promise<void>;
  complete: () => Promise<void>;
}) {
  const t = useTranslations("Player");
  const previous = lessons[lesson.index - 1];
  const isLast = lesson.index === lessons.length - 1;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-6">
      {lesson.lockedUntil ? (
        <LockedNotice opensAt={lesson.lockedUntil} />
      ) : quiz ? (
        <QuizPlayer quiz={quiz.view} submit={quiz.submit} />
      ) : (
        <LessonBody lesson={lesson} fileUrl={fileUrl} savePosition={savePosition} />
      )}

      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {t("lessonOf", { n: lesson.index + 1, total: lessons.length })} · {lesson.sectionTitle}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
      </div>

      <nav className="flex items-center justify-between gap-3 border-t pt-4">
        {previous ? (
          <Button asChild variant="ghost">
            <Link href={`${base}/${previous.id}`}>
              <ArrowLeft aria-hidden />
              {t("previous")}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {lesson.lockedUntil ? null : quiz ? (
          lesson.isCompleted ? (
            <Button asChild>
              <Link href={nextHref}>
                {isLast ? t("finish") : t("continue")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : null
        ) : (
          <form action={complete}>
            <Button type="submit">
              {isLast ? t("finish") : t("completeAndContinue")}
              <ArrowRight aria-hidden />
            </Button>
          </form>
        )}
      </nav>

      {comments ? <LessonComments threads={comments.threads} userId={comments.userId} actions={comments.actions} /> : null}
    </div>
  );
}

/**
 * Stands in for a drip lesson's content until it opens.
 *
 * @param props - Component props.
 * @param props.opensAt - When it opens for the student.
 * @returns The notice with the opening date.
 */
function LockedNotice({ opensAt }: { opensAt: Date }) {
  const t = useTranslations("Player");
  const format = useFormatter();
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
      <Lock aria-hidden className="size-8 text-muted-foreground" />
      <p className="font-medium">{t("lockedTitle", { date: format.dateTime(opensAt, { dateStyle: "long", timeStyle: "short" }) })}</p>
      <p className="text-sm text-muted-foreground">{t("lockedText")}</p>
    </div>
  );
}

/**
 * The lesson's content area for its type.
 *
 * @param props - Component props.
 * @param props.lesson - The lesson to show.
 * @param props.fileUrl - Signed URL of its video or PDF, or null.
 * @param props.savePosition - The video heartbeat.
 * @returns The video, a PDF download card, a not-ready notice, or the lesson text.
 */
function LessonBody({
  lesson,
  fileUrl,
  savePosition,
}: {
  lesson: PlayerLesson;
  fileUrl: string | null;
  savePosition: (positionSeconds: number) => Promise<void>;
}) {
  const t = useTranslations("Player");
  if (lesson.type === "text") {
    return (
      <article className="flex flex-col gap-3 rounded-xl border p-6 leading-relaxed">
        <p>{t("textPlaceholder")}</p>
      </article>
    );
  }
  if (!fileUrl) {
    return <p className="rounded-xl border p-6 text-muted-foreground">{t("fileNotReady")}</p>;
  }
  if (lesson.type === "video") {
    return <LessonVideo src={fileUrl} title={lesson.title} startAt={lesson.positionSeconds} savePosition={savePosition} />;
  }
  return (
    <div className="flex items-center gap-4 rounded-xl border p-6">
      <FileText aria-hidden className="size-10 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="font-medium">{lesson.title}.pdf</p>
        <p className="text-sm text-muted-foreground">{t("pdfHint")}</p>
      </div>
      <Button asChild variant="outline">
        <a href={fileUrl} download>
          <Download aria-hidden />
          {t("download")}
        </a>
      </Button>
    </div>
  );
}
