import { Button } from "@reanit/ui/components/button";
import { Card } from "@reanit/ui/components/card";
import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { courseStats, type MockCourse } from "@/mocks/courses";

import { Duration } from "./duration";
import { LessonIcon } from "./lesson-icon";
import { Price } from "./price";

const INCLUDES = ["lifetime", "certificate", "anyDevice"] as const;

/**
 * Course sales page body: hero, outcomes, curriculum, instructor and FAQ, with a buy box.
 *
 * @param props - Component props.
 * @param props.course - The course on sale.
 * @returns The sales page, with a sticky buy box on desktop and a pinned buy bar on mobile.
 */
export function CourseDetails({ course }: { course: MockCourse }) {
  const t = useTranslations("Course");
  const stats = courseStats(course);

  return (
    <div className="flex flex-col gap-12 pb-20 lg:pb-0">
      <section className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <span className="text-sm font-medium text-primary">{t(`level.${course.level}`)}</span>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{course.title}</h1>
          <p className="text-lg text-muted-foreground">{course.subtitle}</p>
          <p className="text-sm text-muted-foreground">
            {t("byInstructor", { name: course.instructor.name })} · {t("lessons", { count: stats.lessons })} ·{" "}
            <Duration seconds={stats.durationSec} />
          </p>
        </div>
        <BuyBox course={course} className="hidden lg:flex lg:row-span-2 lg:self-start lg:sticky lg:top-24" />

        <div className="flex flex-col gap-12">
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">{t("whatYouLearn")}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {course.outcomes.map((o) => (
                <li key={o} className="flex gap-2 text-sm">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                  {o}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">{t("curriculum")}</h2>
            <div className="divide-y rounded-xl border">
              {course.sections.map((section, i) => (
                <details key={section.title} open={i === 0} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium">
                    <span>{section.title}</span>
                    <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                      {t("lessons", { count: section.lessons.length })}
                      <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <ul className="flex flex-col pb-2">
                    {section.lessons.map((lesson) => (
                      <li key={lesson.title} className="flex items-center gap-3 px-5 py-2 text-sm">
                          <LessonIcon type={lesson.type} className="size-4 shrink-0 text-muted-foreground" />
                          <span className="flex-1">{lesson.title}</span>
                          {lesson.preview ? (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              {t("preview")}
                            </span>
                          ) : null}
                          <span className="w-20 text-right text-muted-foreground">
                            <Duration seconds={lesson.durationSec} />
                          </span>
                        </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">{t("instructor")}</h2>
            <div className="flex gap-4">
              <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                {course.instructor.initials}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-medium">{course.instructor.name}</p>
                <p className="text-sm text-muted-foreground">{course.instructor.title}</p>
                <p className="mt-2 text-sm">{course.instructor.bio}</p>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">{t("faq")}</h2>
            <div className="divide-y rounded-xl border">
              {course.faq.map((item) => (
                <details key={item.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {item.q}
                    <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="pt-3 text-sm text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </section>

      {/* Mobile: price + buy pinned to the bottom. */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-4 border-t bg-background px-4 py-3 lg:hidden">
        <Price course={course} className="text-lg" />
        <Button>{t("enroll")}</Button>
      </div>
    </div>
  );
}

/**
 * Price, enroll button and what the purchase includes.
 *
 * @param props - Component props.
 * @param props.course - The course on sale.
 * @param props.className - Extra classes for the card.
 * @returns The buy card.
 */
function BuyBox({ course, className }: { course: MockCourse; className?: string }) {
  const t = useTranslations("Course");
  return (
    <Card className={className}>
      <div className="aspect-video rounded-lg bg-primary/15" />
      <Price course={course} className="text-2xl" />
      {/* Checkout is built in WEB-14. */}
      <Button size="lg" className="w-full">
        {t("enroll")}
      </Button>
      <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
        {INCLUDES.map((key) => (
          <li key={key} className="flex gap-2">
            <Check aria-hidden className="size-4 shrink-0 text-success" />
            {t(`includes.${key}`)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
