import { summarizeProgress, type PlayerLesson } from "@reanit/core/learning";
import { Progress } from "@reanit/ui/components/progress";
import { ArrowLeft, Award, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type * as React from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";

import { LessonList } from "./lesson-list";

/** Progress of a course whose every lesson is completed, which earns its certificate. */
const COMPLETE_PERCENT = 100;

/**
 * Full-screen player shell: top bar with progress (and the certificate once the course is complete),
 * lesson content, and the course outline (sidebar on desktop, collapsible on mobile).
 *
 * @param props - Component props.
 * @param props.school - The school's subdomain.
 * @param props.title - The course's title.
 * @param props.lessons - The course's lessons in order, with the student's progress.
 * @param props.base - The course's player path.
 * @param props.children - The lesson.
 * @returns The player shell.
 */
export function PlayerShell({
  school,
  title,
  lessons,
  base,
  children,
}: {
  school: string;
  title: string;
  lessons: PlayerLesson[];
  base: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("Player");
  const { percent } = summarizeProgress(lessons);
  const outline = <LessonList lessons={lessons} base={base} />;
  const progressText = t("progress", { percent });

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background px-4">
        <Link
          href={`/s/${school}/my-courses`}
          aria-label={t("backToCourses")}
          className="flex size-9 items-center justify-center rounded-md hover:bg-accent"
        >
          <ArrowLeft aria-hidden className="size-4" />
        </Link>
        <span className="truncate font-medium">{title}</span>
        <div className="ml-auto flex items-center gap-3">
          {percent === COMPLETE_PERCENT ? (
            // Not prefetched: opening it signs a short-lived download link.
            <Link
              href={`${base}/certificate`}
              prefetch={false}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-accent"
            >
              <Award aria-hidden className="size-4" />
              {t("certificate")}
            </Link>
          ) : null}
          <div className="hidden w-40 flex-col gap-1 sm:flex">
            <Progress value={percent} aria-label={t("progressLabel")} />
            <span className="text-xs text-muted-foreground">{progressText}</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <main className="flex-1">{children}</main>

        <aside className="hidden w-80 shrink-0 border-l lg:block">
          <h2 className="px-4 pt-4 pb-2 text-sm font-semibold">{t("courseContent")}</h2>
          {outline}
        </aside>

        <details className="group border-t lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
            {t("courseContent")} · {progressText}
            <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          {outline}
        </details>
      </div>
    </div>
  );
}
