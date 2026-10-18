import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shells/page-placeholder";

export default async function MyCourses() {
  const t = await getTranslations("SchoolNav");
  return <PagePlaceholder title={t("myCourses")} task="WEB-05" />;
}
