import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shells/page-placeholder";

export default async function DashboardOverview() {
  const t = await getTranslations("DashboardNav");
  return <PagePlaceholder title={t("overview")} task="WEB-07" />;
}
