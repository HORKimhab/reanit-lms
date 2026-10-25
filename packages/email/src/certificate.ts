import type { CertificateDocument } from "@reanit/core/learning";

import { emailIntl } from "./intl";

/** The words printed on a certificate, in its student's language. */
export interface CertificateText {
  title: string;
  presentedTo: string;
  completed: string;
  /** The school and the completion date. */
  issued: string;
  /** Label before the verify link. */
  verify: string;
}

/**
 * Writes a certificate's wording in its student's language, with the date in Phnom Penh time, like the emails.
 * The name and course title are printed as they are, untranslated.
 *
 * @param document The certificate.
 * @param document.locale The student's language.
 * @param document.schoolName The school that issued it.
 * @param document.issuedAt When the course was completed.
 * @returns Its labels.
 * @example
 * const text = certificateText({ locale: "km", schoolName: "Angkor Academy", issuedAt });
 * pdf.text(text.title);
 */
export function certificateText({ locale, schoolName, issuedAt }: Pick<CertificateDocument, "locale" | "schoolName" | "issuedAt">): CertificateText {
  const { t, format } = emailIntl(locale);
  return {
    title: t("Certificate.title"),
    presentedTo: t("Certificate.presentedTo"),
    completed: t("Certificate.completed"),
    issued: t("Certificate.issued", { school: schoolName, date: format.dateTime(issuedAt, { dateStyle: "long" }) }),
    verify: t("Certificate.verify"),
  };
}
