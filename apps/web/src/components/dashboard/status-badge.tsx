import type { CourseStatus } from "@reanit/core/catalog";
import { cn } from "@reanit/ui/lib/utils";
import { useTranslations } from "next-intl";

/**
 * A course's or bundle's publishing status as a small colored label.
 *
 * @param props - Component props.
 * @param props.status - Draft or published.
 * @returns The label, green when published.
 */
export function StatusBadge({ status }: { status: CourseStatus }) {
  const t = useTranslations("Dashboard.courseStatus");
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        status === "published" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
      )}
    >
      {t(status)}
    </span>
  );
}
