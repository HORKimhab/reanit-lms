import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shells/page-placeholder";

export default async function SchoolHome() {
  const t = await getTranslations("SchoolNav");
  return <PagePlaceholder title={t("courses")} task="WEB-04" />;
}
