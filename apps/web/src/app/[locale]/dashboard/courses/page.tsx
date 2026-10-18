import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shells/page-placeholder";

/**
 * Dashboard course list, until WEB-07 builds it.
 *
 * @returns The page heading and a placeholder.
 */
export default async function DashboardCourses() {
  const t = await getTranslations("DashboardNav");
  return <PagePlaceholder title={t("courses")} task="WEB-07" />;
}
