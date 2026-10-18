import { Progress } from "@reanit/ui/components/progress";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type * as React from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";
import type { MockEnrollment } from "@/mocks/enrollments";

import { LessonList } from "./lesson-list";

/**
 * Full-screen player shell: top bar with progress, lesson content, and the course outline
 * (sidebar on desktop, collapsible on mobile).
 *
 * @param props - Component props.
 * @param props.school - The school's slug.
 * @param props.enrollment - The student's enrollment in the course being played.
 * @param props.children - The lesson.
 * @returns The player shell.
 */
export function PlayerShell({
  school,
  enrollment,
  children,
}: {
  school: string;
  enrollment: MockEnrollment;
  children: React.ReactNode;
}) {
  const t = useTranslations("Player");
  const { course, percent, completedLessons } = enrollment;
  const outline = <LessonList course={course} completedLessons={completedLessons} />;
  const progressText = t("progress", { percent: Math.round(percent) });

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
        <span className="truncate font-medium">{course.title}</span>
        <div className="ml-auto flex items-center gap-3">
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
