import { Link, Text } from "@react-email/components";
import type { EmailLocale } from "@reanit/core/notifications";

import { emailIntl } from "./intl";
import { EmailLayout } from "./layout";

/**
 * The one-time sign-in link.
 *
 * @param props - Email props.
 * @param props.locale - The reader's language.
 * @param props.url - The sign-in link.
 * @param props.minutes - How long it works.
 * @returns The email document.
 */
export function MagicLinkEmail({ locale, url, minutes }: { locale: EmailLocale; url: string; minutes: number }) {
  const { t } = emailIntl(locale);
  return (
    <EmailLayout
      lang={locale}
      preview={t("MagicLink.body", { minutes })}
      heading={t("MagicLink.heading")}
      action={{ label: t("MagicLink.button"), href: url }}
      footer={t("MagicLink.sentBy")}
    >
      <Text>{t("MagicLink.body", { minutes })}</Text>
      <Text style={{ color: "#71717a", fontSize: 13 }}>
        {t("MagicLink.fallback")} <Link href={url}>{url}</Link>
      </Text>
      <Text style={{ color: "#71717a", fontSize: 13 }}>{t("MagicLink.ignore")}</Text>
    </EmailLayout>
  );
}
