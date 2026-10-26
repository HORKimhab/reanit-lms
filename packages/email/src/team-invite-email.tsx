import { Link, Text } from "@react-email/components";
import type { EmailLocale } from "@reanit/core/notifications";
import type { InviteRole } from "@reanit/core/schools";

import { emailIntl } from "./intl";
import { EmailLayout } from "./layout";

/** What a team invite email says. */
export interface TeamInvite {
  locale: EmailLocale;
  /** The page that accepts the invite. */
  url: string;
  school: string;
  /** Who sent it; null when they gave no name, then the email names the school only. */
  inviter: string | null;
  role: InviteRole;
  /** How long the link works. */
  days: number;
}

/**
 * The invitation to join a school's team as an admin or instructor.
 *
 * @param props - Email props, as `TeamInvite` describes them.
 * @param props.locale - The reader's language.
 * @param props.url - The page that accepts the invite.
 * @param props.school - The school's name.
 * @param props.inviter - Who sent it, or null.
 * @param props.role - The role it gives.
 * @param props.days - How long the link works.
 * @returns The email document.
 */
export function TeamInviteEmail({ locale, url, school, inviter, role, days }: TeamInvite) {
  const { t } = emailIntl(locale);
  const roleName = t(`TeamInvite.roles.${role}`);
  const body = inviter ? t("TeamInvite.bodyFrom", { inviter, school, role: roleName }) : t("TeamInvite.body", { school, role: roleName });
  return (
    <EmailLayout
      lang={locale}
      preview={body}
      heading={t("TeamInvite.heading", { school })}
      action={{ label: t("TeamInvite.button"), href: url }}
      footer={t("MagicLink.sentBy")}
    >
      <Text>{body}</Text>
      <Text>{t("TeamInvite.expiry", { days })}</Text>
      <Text style={{ color: "#71717a", fontSize: 13 }}>
        {t("MagicLink.fallback")} <Link href={url}>{url}</Link>
      </Text>
      <Text style={{ color: "#71717a", fontSize: 13 }}>{t("TeamInvite.ignore")}</Text>
    </EmailLayout>
  );
}
