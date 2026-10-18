import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shells/page-placeholder";

export default async function DashboardStudents() {
  const t = await getTranslations("DashboardNav");
  return <PagePlaceholder title={t("students")} task="WEB-09" />;
}
