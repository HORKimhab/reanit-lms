import { cn } from "@reanit/ui/lib/utils";
import { Check } from "lucide-react";

import { Duration } from "@/components/course/duration";
import { LessonIcon } from "@/components/course/lesson-icon";
import { NavLink } from "@/components/shells/nav-link";
import { flattenLessons, type MockCourse } from "@/mocks/courses";

/**
 * Course outline for the player: sections, lessons with done marks, and the current lesson highlighted.
 *
 * @param props - Component props.
 * @param props.course - The course being played.
 * @param props.completedLessons - Lessons finished so far, counted from the start.
 * @returns One headed list per section, each lesson linking to its player page.
 */
export function LessonList({ course, completedLessons }: { course: MockCourse; completedLessons: number }) {
  const lessons = flattenLessons(course);
  const base = `/s/${course.schoolSlug}/learn/${course.slug}`;

  return (
    <div className="flex flex-col pb-4">
      {course.sections.map((section, si) => (
        <section key={section.title} className="flex flex-col">
          <h3 className="px-4 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {section.title}
          </h3>
          <ul>
            {lessons
              .filter((l) => l.sectionIndex === si)
              .map((lesson) => {
                const isDone = lesson.index < completedLessons;
                return (
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
                          isDone ? "bg-success text-white" : "border",
                        )}
                      >
                        {isDone ? <Check aria-hidden className="size-3" /> : null}
                      </span>
                      <span className="flex-1">{lesson.title}</span>
                      <LessonIcon type={lesson.type} className="size-4 shrink-0 text-muted-foreground" />
                      <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                        <Duration seconds={lesson.durationSec} />
                      </span>
                    </NavLink>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
