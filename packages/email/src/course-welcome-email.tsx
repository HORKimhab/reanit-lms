import { Text } from "@react-email/components";
import type { EmailLocale } from "@reanit/core/notifications";

import { emailIntl } from "./intl";
import { EmailLayout } from "./layout";

/**
 * Welcomes a buyer to a course they now have, with a link to start it.
 *
 * @param props - Email props.
 * @param props.locale - The reader's language.
 * @param props.buyerName - Their name, if they gave one.
 * @param props.schoolName - The school that sold the course.
 * @param props.courseTitle - The course.
 * @param props.courseUrl - The course's player.
 * @returns The email document.
 */
export function CourseWelcomeEmail({
  locale,
  buyerName,
  schoolName,
  courseTitle,
  courseUrl,
}: {
  locale: EmailLocale;
  buyerName: string | null;
  schoolName: string;
  courseTitle: string;
  courseUrl: string;
}) {
  const { t } = emailIntl(locale);
  return (
    <EmailLayout
      lang={locale}
      preview={t("Welcome.body", { course: courseTitle, school: schoolName })}
      heading={t("Welcome.heading", { course: courseTitle })}
      action={{ label: t("Welcome.button"), href: courseUrl }}
      footer={t("Common.sentBy", { school: schoolName })}
    >
      <Text>{buyerName ? t("Common.greeting", { name: buyerName }) : t("Common.greetingNoName")}</Text>
      <Text>{t("Welcome.body", { course: courseTitle, school: schoolName })}</Text>
    </EmailLayout>
  );
}
