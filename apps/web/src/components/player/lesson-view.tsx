import type { PlayerLesson } from "@reanit/core/learning";
import { Button } from "@reanit/ui/components/button";
import { ArrowLeft, ArrowRight, Download, FileText } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { LessonVideo } from "./lesson-video";

/**
 * One lesson in the player: content, position in the course, and previous / complete-and-continue navigation.
 *
 * @param props - Component props.
 * @param props.lessons - Every lesson in the course, in order.
 * @param props.lesson - The lesson to show; one of `lessons`.
 * @param props.base - The course's player path.
 * @param props.fileUrl - Signed URL of the lesson's video or PDF; null for text lessons and files not uploaded yet.
 * @param props.savePosition - The video heartbeat, bound to the lesson.
 * @param props.complete - Marks the lesson completed and moves on, bound to the lesson and the next page.
 * @returns The lesson's content, title and position, and links to the previous and next lessons.
 */
export function LessonView({
  lessons,
  lesson,
  base,
  fileUrl,
  savePosition,
  complete,
}: {
  lessons: PlayerLesson[];
  lesson: PlayerLesson;
  base: string;
  fileUrl: string | null;
  savePosition: (positionSeconds: number) => Promise<void>;
  complete: () => Promise<void>;
}) {
  const t = useTranslations("Player");
  const previous = lessons[lesson.index - 1];
  const isLast = lesson.index === lessons.length - 1;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <LessonBody lesson={lesson} fileUrl={fileUrl} savePosition={savePosition} />

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
        <form action={complete}>
          <Button type="submit">
            {isLast ? t("finish") : t("completeAndContinue")}
            <ArrowRight aria-hidden />
          </Button>
        </form>
      </nav>
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
