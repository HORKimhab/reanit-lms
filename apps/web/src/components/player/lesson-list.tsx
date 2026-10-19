import type { PlayerLesson } from "@reanit/core/learning";
import { cn } from "@reanit/ui/lib/utils";
import { Check, Lock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Duration } from "@/components/course/duration";
import { LessonIcon } from "@/components/course/lesson-icon";
import { NavLink } from "@/components/shells/nav-link";

/**
 * Course outline for the player: sections, lessons with done marks (or a lock and opening date for
 * drip lessons not open yet), and the current lesson highlighted.
 *
 * @param props - Component props.
 * @param props.lessons - The course's lessons in order, with the student's progress.
 * @param props.base - The course's player path; each lesson links to `<base>/<lesson id>`.
 * @returns One headed list per section, each lesson linking to its player page.
 */
export function LessonList({ lessons, base }: { lessons: PlayerLesson[]; base: string }) {
  const t = useTranslations("Player");
  const format = useFormatter();
  const sections = new Map<string, PlayerLesson[]>();
  for (const lesson of lessons) sections.set(lesson.sectionId, [...(sections.get(lesson.sectionId) ?? []), lesson]);

  return (
    <div className="flex flex-col pb-4">
      {[...sections].map(([sectionId, sectionLessons]) => (
        <section key={sectionId} className="flex flex-col">
          <h3 className="px-4 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {sectionLessons[0]?.sectionTitle}
          </h3>
          <ul>
            {sectionLessons.map((lesson) => (
              <li key={lesson.id}>
                <NavLink
                  href={`${base}/${lesson.id}`}
                  exact
                  className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent"
                  activeClassName="bg-primary/10 text-foreground font-medium"
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full",
                      lesson.isCompleted ? "bg-success text-white" : "border",
                    )}
                  >
                    {lesson.isCompleted ? <Check aria-hidden className="size-3" /> : null}
                    {lesson.lockedUntil && !lesson.isCompleted ? <Lock aria-hidden className="size-3 text-muted-foreground" /> : null}
                  </span>
                  <span className="flex flex-1 flex-col">
                    {lesson.title}
                    {lesson.lockedUntil ? (
                      <span className="text-xs text-muted-foreground">{t("opensOn", { date: format.dateTime(lesson.lockedUntil, { dateStyle: "medium" }) })}</span>
                    ) : null}
                  </span>
                  <LessonIcon type={lesson.type} className="size-4 shrink-0 text-muted-foreground" />
                  <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                    <Duration seconds={lesson.durationSeconds} />
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
