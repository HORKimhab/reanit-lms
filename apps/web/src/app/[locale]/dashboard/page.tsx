import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shells/page-placeholder";

/**
 * Dashboard overview, until WEB-07 builds it.
 *
 * @returns The page heading and a placeholder.
 */
export default async function DashboardOverview() {
  const t = await getTranslations("DashboardNav");
  return <PagePlaceholder title={t("overview")} task="WEB-07" />;
}
