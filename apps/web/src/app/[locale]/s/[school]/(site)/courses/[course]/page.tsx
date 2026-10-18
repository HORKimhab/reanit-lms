import { Button } from "@reanit/ui/components/button";
import { Card } from "@reanit/ui/components/card";
import { Check, ChevronDown, FileText, PlayCircle, AlignLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { use } from "react";

import { Duration } from "@/components/course/duration";
import { Price } from "@/components/course/price";
import { courseStats, getMockCourse, type LessonType, type MockCourse } from "@/mocks/courses";

const LESSON_ICON: Record<LessonType, typeof PlayCircle> = { video: PlayCircle, text: AlignLeft, pdf: FileText };

// Course sales page: hero → outcomes → curriculum → instructor → FAQ, with a buy box.
export default function CoursePage({ params }: { params: Promise<{ school: string; course: string }> }) {
  const { school, course: slug } = use(params);
  const course = getMockCourse(school, slug);
  if (!course) notFound();
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
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
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
                      <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <ul className="flex flex-col pb-2">
                    {section.lessons.map((lesson) => {
                      const Icon = LESSON_ICON[lesson.type];
                      return (
                        <li key={lesson.title} className="flex items-center gap-3 px-5 py-2 text-sm">
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
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
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">{t("instructor")}</h2>
            <div className="flex gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
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
                    <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
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
        {(["lifetime", "certificate", "anyDevice"] as const).map((key) => (
          <li key={key} className="flex gap-2">
            <Check className="size-4 shrink-0 text-success" />
            {t(`includes.${key}`)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
