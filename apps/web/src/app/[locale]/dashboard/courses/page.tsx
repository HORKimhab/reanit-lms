import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shells/page-placeholder";

export default async function DashboardCourses() {
  const t = await getTranslations("DashboardNav");
  return <PagePlaceholder title={t("courses")} task="WEB-07" />;
}
