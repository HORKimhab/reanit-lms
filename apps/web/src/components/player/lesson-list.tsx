import { Check, FileText, PlayCircle, AlignLeft } from "lucide-react";

import { Duration } from "@/components/course/duration";
import { NavLink } from "@/components/shells/nav-link";
import { flattenLessons, type LessonType, type MockCourse } from "@/mocks/courses";

const LESSON_ICON: Record<LessonType, typeof PlayCircle> = { video: PlayCircle, text: AlignLeft, pdf: FileText };

// Course outline with completion marks; the current lesson is highlighted by NavLink.
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
                const done = lesson.index < completedLessons;
                const Icon = LESSON_ICON[lesson.type];
                return (
                  <li key={lesson.id}>
                    <NavLink
                      href={`${base}/${lesson.id}`}
                      exact
                      className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent"
                      activeClassName="bg-primary/10 text-foreground font-medium"
                    >
                      <span
                        className={
                          done
                            ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-white"
                            : "flex size-5 shrink-0 items-center justify-center rounded-full border"
                        }
                      >
                        {done ? <Check className="size-3" /> : null}
                      </span>
                      <span className="flex-1">{lesson.title}</span>
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
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
