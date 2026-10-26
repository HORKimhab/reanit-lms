import type { CourseStatus } from "@reanit/core/catalog";
import { useTranslations } from "next-intl";

import { Pill } from "@/components/shells/pill";

/**
 * A course's or bundle's publishing status as a small colored label.
 *
 * @param props - Component props.
 * @param props.status - Draft or published.
 * @returns The label, green when published.
 */
export function StatusBadge({ status }: { status: CourseStatus }) {
  const t = useTranslations("Dashboard.courseStatus");
  return <Pill tone={status === "published" ? "success" : "muted"}>{t(status)}</Pill>;
}
