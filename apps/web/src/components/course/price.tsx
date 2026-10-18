import { cn } from "@reanit/ui/lib/utils";

import { useMoney } from "@/i18n/format";
import type { MockCourse } from "@/mocks/courses";

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
