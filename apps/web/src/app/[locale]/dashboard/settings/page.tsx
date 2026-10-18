import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shells/page-placeholder";

/**
 * School settings, until WEB-09 builds it.
 *
 * @returns The page heading and a placeholder.
 */
export default async function DashboardSettings() {
  const t = await getTranslations("DashboardNav");
  return <PagePlaceholder title={t("settings")} task="WEB-09" />;
}
