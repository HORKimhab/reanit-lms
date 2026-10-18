import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shells/page-placeholder";

export default async function DashboardSettings() {
  const t = await getTranslations("DashboardNav");
  return <PagePlaceholder title={t("settings")} task="WEB-09" />;
}
