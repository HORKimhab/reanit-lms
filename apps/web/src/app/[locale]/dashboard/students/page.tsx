import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shells/page-placeholder";

/**
 * Students list, until WEB-09 builds it.
 *
 * @returns The page heading and a placeholder.
 */
export default async function DashboardStudents() {
  const t = await getTranslations("DashboardNav");
  return <PagePlaceholder title={t("students")} task="WEB-09" />;
}
