import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/shells/empty-state";
import { getCertificateDownloadUrl } from "@/server/learning/certificates";

/**
 * Opens the student's certificate PDF through a freshly signed link, or says it is still being made
 * (the worker draws it a moment after the last lesson is completed).
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain and the course slug.
 * @returns The "on its way" notice; otherwise it redirects to the PDF.
 * @throws {Error} Next's redirect signal to the PDF, or to log in when signed out.
 */
export default async function CertificateDownload({ params }: PageProps<"/[locale]/s/[school]/learn/[course]/certificate">) {
  const { school, course: slug } = await params;
  const url = await getCertificateDownloadUrl(school, decodeURIComponent(slug), `/s/${school}/learn/${slug}/certificate`);
  if (url) redirect(url);
  const t = await getTranslations("Player");
  return <EmptyState title={t("certificatePendingTitle")} text={t("certificatePendingText")} />;
}
