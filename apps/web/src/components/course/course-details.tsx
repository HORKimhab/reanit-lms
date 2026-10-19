import { outlineStats, type CourseWithOutline } from "@reanit/core/catalog";
import type { PriceInput } from "@reanit/core/commerce";
import { Button } from "@reanit/ui/components/button";
import { Card } from "@reanit/ui/components/card";
import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { useMoney } from "@/i18n/format";
import { Link } from "@/i18n/navigation";

import { Duration } from "./duration";
import { LessonIcon } from "./lesson-icon";

const INCLUDES = ["lifetime", "certificate", "anyDevice"] as const;

/** A course's price; null while it is not for sale. */
type CoursePrice = PriceInput | null;

/**
 * Course sales page body: hero, curriculum and instructor, with a buy box.
 *
 * @param props - Component props.
 * @param props.course - The published course with its curriculum.
 * @param props.instructorName - Who teaches it.
 * @param props.price - Its price, or null when it is not for sale yet.
 * @param props.checkoutHref - The course's checkout page.
 * @returns The sales page, with a sticky buy box on desktop and a pinned enroll bar on mobile.
 */
export function CourseDetails({
  course,
  instructorName,
  price,
  checkoutHref,
}: {
  course: CourseWithOutline;
  instructorName: string;
  price: CoursePrice;
  checkoutHref: string;
}) {
  const t = useTranslations("Course");
  const stats = outlineStats(course);

  return (
    <div className="flex flex-col gap-12 pb-20 lg:pb-0">
      <section className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{course.title}</h1>
          {course.description ? <p className="whitespace-pre-line text-lg text-muted-foreground">{course.description}</p> : null}
          <p className="text-sm text-muted-foreground">
            {t("byInstructor", { name: instructorName })} · {t("lessons", { count: stats.lessons })} ·{" "}
            <Duration seconds={stats.durationSeconds} />
          </p>
        </div>
        <BuyBox price={price} checkoutHref={checkoutHref} className="hidden lg:flex lg:row-span-2 lg:self-start lg:sticky lg:top-24" />

        <div className="flex flex-col gap-12">
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">{t("curriculum")}</h2>
            {course.sections.length === 0 ? (
              <p className="rounded-xl border border-dashed px-5 py-6 text-sm text-muted-foreground">{t("emptyCurriculum")}</p>
            ) : (
              <div className="divide-y rounded-xl border">
                {course.sections.map((section, i) => (
                  <details key={section.id} open={i === 0} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium">
                      <span>{section.title}</span>
                      <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                        {t("lessons", { count: section.lessons.length })}
                        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
                      </span>
                    </summary>
                    <ul className="flex flex-col pb-2">
                      {section.lessons.map((lesson) => (
                        <li key={lesson.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                          <LessonIcon type={lesson.type} className="size-4 shrink-0 text-muted-foreground" />
                          <span className="flex-1">{lesson.title}</span>
                          <span className="w-20 text-right text-muted-foreground">
                            <Duration seconds={lesson.durationSeconds} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">{t("instructor")}</h2>
            <div className="flex gap-4">
              <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                {instructorName.charAt(0).toUpperCase()}
              </span>
              <p className="self-center font-medium">{instructorName}</p>
            </div>
          </section>

        </div>
      </section>

      {/* Mobile: enroll pinned to the bottom. */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-4 border-t bg-background px-4 py-3 lg:hidden">
        <PriceTag price={price} />
        <EnrollButton price={price} checkoutHref={checkoutHref} />
      </div>
    </div>
  );
}

/**
 * The price, or "coming soon" when the course is not for sale.
 *
 * @param props - Component props.
 * @param props.price - The price, or null.
 * @returns The localized price.
 */
function PriceTag({ price }: { price: CoursePrice }) {
  const t = useTranslations("Course");
  const money = useMoney();
  return <span className="text-2xl font-bold">{price ? money(price.amount, price.currency) : t("notForSale")}</span>;
}

/**
 * Link to checkout; nothing while the course is not for sale.
 *
 * @param props - Component props.
 * @param props.price - The price, or null.
 * @param props.checkoutHref - The course's checkout page.
 * @param props.className - Extra classes for the button.
 * @returns The enroll button, or null.
 */
function EnrollButton({ price, checkoutHref, className }: { price: CoursePrice; checkoutHref: string; className?: string }) {
  const t = useTranslations("Course");
  if (!price) return null;
  return (
    <Button asChild size="lg" className={className}>
      <Link href={checkoutHref}>{t("enroll")}</Link>
    </Button>
  );
}

/**
 * Price, enroll button and what the purchase includes.
 *
 * @param props - Component props.
 * @param props.price - The price, or null when not for sale.
 * @param props.checkoutHref - The course's checkout page.
 * @param props.className - Extra classes for the card.
 * @returns The buy card.
 */
function BuyBox({ price, checkoutHref, className }: { price: CoursePrice; checkoutHref: string; className?: string }) {
  const t = useTranslations("Course");
  return (
    <Card className={className}>
      <div className="aspect-video rounded-lg bg-primary/15" />
      <PriceTag price={price} />
      <EnrollButton price={price} checkoutHref={checkoutHref} className="w-full" />
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
