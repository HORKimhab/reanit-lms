import { cn } from "@reanit/ui/lib/utils";

import { useMoney } from "@/i18n/format";
import type { MockCourse } from "@/mocks/courses";

/**
 * Shows a course's price, with the struck-through "was" price when there is one.
 *
 * @param props - Component props.
 * @param props.course - The course whose price to show.
 * @param props.className - Extra classes for the wrapper.
 * @returns The localized price.
 */
export function Price({ course, className }: { course: MockCourse; className?: string }) {
  const money = useMoney();
  return (
    <span className={cn("flex items-baseline gap-2", className)}>
      <span className="font-semibold">{money(course.priceMinor, course.currency)}</span>
      {course.compareAtMinor ? (
        <s className="text-sm text-muted-foreground">{money(course.compareAtMinor, course.currency)}</s>
      ) : null}
    </span>
  );
}
