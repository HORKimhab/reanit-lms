import type { Team } from "@reanit/core/schools";
import { useFormatter, useTranslations } from "next-intl";

import type { TeamInviteState } from "@/app/[locale]/dashboard/settings/actions";
import { Cell, DataTable, RowHeader } from "@/components/dashboard/data-table";
import { InviteForm } from "@/components/team/invite-form";
import { MemberActions } from "@/components/team/member-actions";

import { SettingsSection } from "./settings-section";

/** What the team section does: invite, change a member's role, remove a member. */
export type TeamActions = {
  invite: (state: TeamInviteState, formData: FormData) => Promise<TeamInviteState>;
  /** Saves a member's role from the role form. */
  changeRole: (userId: string, formData: FormData) => Promise<void>;
  remove: (userId: string) => Promise<void>;
};

/**
 * The school's team: its staff with their roles (the owner's fixed, the others changeable and
 * removable), the invites waiting for an answer, and a form to invite someone.
 *
 * @param props - Component props.
 * @param props.team - The members, owner first, and the invites.
 * @param props.now - The current time, to tell expired invites apart.
 * @param props.actions - Invite, change a role, remove a member.
 * @returns The team section.
 */
export function TeamSection({ team, now, actions }: { team: Team; now: Date; actions: TeamActions }) {
  const t = useTranslations("Team");
  const format = useFormatter();

  return (
    <SettingsSection id="team" title={t("title")} intro={t("intro")}>
      <DataTable caption={t("membersCaption")} columns={[{ label: t("member") }, { label: t("role") }]}>
        {team.members.map((member) => (
          <tr key={member.id}>
            <RowHeader>
              <span className="block">{member.name ?? member.email}</span>
              {member.name ? <span className="block text-xs font-normal text-muted-foreground">{member.email}</span> : null}
            </RowHeader>
            <Cell>
              {member.role === "owner" ? (
                t("roles.owner")
              ) : (
                <MemberActions member={member} changeRole={actions.changeRole.bind(null, member.id)} remove={actions.remove.bind(null, member.id)} />
              )}
            </Cell>
          </tr>
        ))}
      </DataTable>
      {team.invites.length > 0 ? (
        <DataTable caption={t("invitesCaption")} columns={[{ label: t("email") }, { label: t("role") }, { label: t("expires") }]}>
          {team.invites.map((invite) => (
            <tr key={invite.id}>
              <RowHeader>{invite.email}</RowHeader>
              <Cell>{t(`roles.${invite.role}`)}</Cell>
              <Cell>{invite.expiresAt <= now ? t("expired") : format.dateTime(invite.expiresAt, { dateStyle: "medium" })}</Cell>
            </tr>
          ))}
        </DataTable>
      ) : null}
      <InviteForm action={actions.invite} />
    </SettingsSection>
  );
}
