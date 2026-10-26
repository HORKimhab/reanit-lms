"use client";

import { INVITE_ROLES } from "@reanit/core/schools";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { TeamInviteState } from "@/app/[locale]/dashboard/settings/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";
import { SubmitRow } from "@/components/form/submit-row";

const INITIAL_STATE: TeamInviteState = { status: "idle" };

/**
 * Invites someone to the team by email as an admin or instructor; they get a link that works for a week.
 *
 * @param props - Component props.
 * @param props.action - Sends the invite.
 * @returns The invite form.
 */
export function InviteForm({ action }: { action: (state: TeamInviteState, formData: FormData) => Promise<TeamInviteState> }) {
  const t = useTranslations("Team");
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const emailError = state.status === "invalid" || state.status === "member" ? t(`errors.${state.status}`) : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border p-5">
      <h3 className="font-semibold">{t("inviteTitle")}</h3>
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label={t("email")} error={emailError}>
          {(control) => <input {...control} name="email" type="email" required autoComplete="off" className={INPUT_CLASS} />}
        </Field>
        <Field label={t("role")}>
          {(control) => (
            <select {...control} name="role" defaultValue="instructor" className={INPUT_CLASS}>
              {INVITE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`roles.${role}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      {state.status === "planLimit" ? (
        <p role="alert" className="text-sm text-destructive">
          {t("errors.planLimit")}
        </p>
      ) : null}
      <SubmitRow label={t("send")} pendingLabel={t("sending")} isPending={isPending} savedMessage={state.status === "sent" ? t("sent") : undefined} />
    </form>
  );
}
