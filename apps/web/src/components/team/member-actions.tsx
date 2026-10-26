"use client";

import { INVITE_ROLES, type TeamMember } from "@reanit/core/schools";
import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";

import { ConfirmButton } from "@/components/form/confirm-button";
import { INPUT_CLASS } from "@/components/form/field";

/**
 * A team member's role, which can change, and a way to remove them after a confirmation.
 *
 * @param props - Component props.
 * @param props.member - An admin or instructor; the owner has no actions.
 * @param props.changeRole - Saves the role chosen in the form; bound to the member.
 * @param props.remove - Removes the member; bound to them.
 * @returns The role form and the remove button.
 */
export function MemberActions({
  member,
  changeRole,
  remove,
}: {
  member: TeamMember;
  changeRole: (formData: FormData) => Promise<void>;
  remove: () => Promise<void>;
}) {
  const t = useTranslations("Team");
  const who = member.name ?? member.email;

  return (
    <div className="flex flex-col gap-2">
      <form action={changeRole} className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`role-${member.id}`}>
          {t("roleOf", { name: who })}
        </label>
        <select id={`role-${member.id}`} name="role" defaultValue={member.role} className={INPUT_CLASS}>
          {INVITE_ROLES.map((role) => (
            <option key={role} value={role}>
              {t(`roles.${role}`)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm">
          {t("changeRole")}
        </Button>
      </form>
      <ConfirmButton
        action={remove}
        labels={{ trigger: t("remove"), warning: t("removeWarning", { name: who }), confirm: t("confirmRemove"), pending: t("removing"), cancel: t("cancel") }}
      />
    </div>
  );
}
