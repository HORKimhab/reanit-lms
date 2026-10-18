import { Button } from "@reanit/ui/components/button";
import { ArrowLeft, ArrowRight, Download, FileText, Play } from "lucide-react";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { use } from "react";

import { Duration } from "@/components/course/duration";
import { Link } from "@/i18n/navigation";
import { flattenLessons, type FlatLesson } from "@/mocks/courses";
import { getMockEnrollment } from "@/mocks/enrollments";

/**
 * One lesson in the player: content, position in the course, and previous / next navigation.
 * 404s when the student is not enrolled or the lesson does not exist.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school, course and lesson.
 * @returns The lesson page.
 */
export default function LessonPage({ params }: PageProps<"/[locale]/s/[school]/learn/[course]/[lesson]">) {
  const { school, course: slug, lesson: lessonId } = use(params);
  const enrollment = getMockEnrollment(school, slug);
  const lessons = enrollment ? flattenLessons(enrollment.course) : [];
  const lesson = lessons.find((l) => l.id === lessonId);
  if (!enrollment || !lesson) notFound();
  const t = useTranslations("Player");
  const prev = lessons[lesson.index - 1];
  const next = lessons[lesson.index + 1];
  const base = `/s/${school}/learn/${slug}`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <LessonBody lesson={lesson} />

      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {t("lessonOf", { n: lesson.index + 1, total: lessons.length })} ·{" "}
          {lesson.sectionTitle}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
      </div>

      <nav className="flex items-center justify-between gap-3 border-t pt-4">
        {prev ? (
          <Button asChild variant="ghost">
            <Link href={`${base}/${prev.id}`}>
              <ArrowLeft aria-hidden />
              {t("previous")}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {/* Marking complete is wired to the API in WEB-15; for now it only moves on. */}
        <Button asChild>
          <Link href={next ? `${base}/${next.id}` : `/s/${school}/my-courses`}>
            {next ? t("completeAndContinue") : t("finish")}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </nav>
    </div>
  );
}

/**
 * The lesson's content area for its type.
 *
 * @param props - Component props.
 * @param props.lesson - The lesson to show.
 * @returns A video stand-in, a PDF download card, or the lesson text.
 */
function LessonBody({ lesson }: { lesson: FlatLesson }) {
  const t = useTranslations("Player");
  if (lesson.type === "video") {
    // Real playback (signed HLS from the video provider) arrives with API-04.
    return (
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-neutral-950 text-white">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Play aria-hidden className="size-7 translate-x-0.5" />
        </span>
        <span className="absolute right-3 bottom-3 rounded bg-black/60 px-2 py-0.5 text-xs">
          <Duration seconds={lesson.durationSec} />
        </span>
      </div>
    );
  }
  if (lesson.type === "pdf") {
    return (
      <div className="flex items-center gap-4 rounded-xl border p-6">
        <FileText aria-hidden className="size-10 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="font-medium">{lesson.title}.pdf</p>
          <p className="text-sm text-muted-foreground">{t("pdfHint")}</p>
        </div>
        <Button variant="outline">
          <Download aria-hidden />
          {t("download")}
        </Button>
      </div>
    );
  }
  return (
    <article className="flex flex-col gap-3 rounded-xl border p-6 leading-relaxed">
      <p>{t("textPlaceholder")}</p>
    </article>
  );
}
