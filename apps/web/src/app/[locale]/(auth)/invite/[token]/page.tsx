import { getTranslations } from "next-intl/server";

import { InviteCard } from "@/components/team/invite-card";
import { getCurrentUser } from "@/server/auth/session";
import { getInviteLink, invitePath } from "@/server/schools/team";

import { acceptInvite } from "./actions";

/**
 * Where a team invite email lands: what the invite is for and how to accept it, or that it expired.
 *
 * @param props - Page props.
 * @param props.params - Route params with the invite's token.
 * @returns The invite card, or the expiry notice.
 * @throws {Error} Next's not-found signal for a link that is unknown, used or replaced.
 */
export default async function InvitePage({ params }: PageProps<"/[locale]/invite/[token]">) {
  const { token } = await params;
  const [link, user, t] = await Promise.all([getInviteLink(token), getCurrentUser(), getTranslations("Invite")]);
  if (link.status === "expired") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t("expiredTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("expiredText")}</p>
      </div>
    );
  }
  return <InviteCard invite={link.invite} user={user} returnPath={invitePath(token)} accept={acceptInvite.bind(null, token)} />;
}
