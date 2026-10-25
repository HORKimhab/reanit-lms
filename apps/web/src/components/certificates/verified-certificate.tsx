import type { Certificate } from "@reanit/core/learning";
import { BadgeCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type * as React from "react";

// The certificate PDF prints its date in Phnom Penh time; the page shows the same day.
const CERTIFICATE_TIME_ZONE = "Asia/Phnom_Penh";

/**
 * Confirms a certificate is real: who earned which course, from which school, and when.
 *
 * @param props - Component props.
 * @param props.certificate - The certificate the school issued.
 * @returns The verified certificate's details.
 */
export function VerifiedCertificate({ certificate }: { certificate: Certificate }) {
  const t = useTranslations("CertificatePage");
  const format = useFormatter();

  /**
   * Marks the date in the sentence up as a machine-readable time.
   *
   * @param chunks - The formatted date.
   * @returns The time element.
   */
  function time(chunks: React.ReactNode) {
    return <time dateTime={certificate.issuedAt.toISOString()}>{chunks}</time>;
  }

  return (
    <article className="mx-auto flex max-w-2xl flex-col items-center gap-6 rounded-xl border p-8 text-center sm:p-12">
      <p className="flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
        <BadgeCheck aria-hidden className="size-4" />
        {t("verified")}
      </p>
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground">{t("presentedTo")}</p>
        <h1 className="text-3xl font-bold tracking-tight">{certificate.studentName}</h1>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground">{t("completed")}</p>
        <p className="text-xl font-semibold">{certificate.courseTitle}</p>
      </div>
      <p>
        {t.rich("issued", {
          school: certificate.schoolName,
          date: format.dateTime(certificate.issuedAt, { dateStyle: "long", timeZone: CERTIFICATE_TIME_ZONE }),
          time,
        })}
      </p>
    </article>
  );
}
