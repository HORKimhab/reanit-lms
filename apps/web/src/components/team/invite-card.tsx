"use client";

import type { AuthUser } from "@reanit/core/auth";
import type { InvitePreview } from "@reanit/core/schools";
import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { AcceptInviteState } from "@/app/[locale]/(auth)/invite/[token]/actions";
import { Link } from "@/i18n/navigation";

const INITIAL_STATE: AcceptInviteState = { status: "idle" };

/**
 * An invite to a school's team, as its link opens it: what it is for, then a way in. Signed out,
 * the visitor logs in or signs up and comes back; signed in with the invited email, they accept;
 * signed in with another, they are told to switch.
 *
 * @param props - Component props.
 * @param props.invite - The school, the role and the invited email.
 * @param props.user - The signed-in user, or null.
 * @param props.returnPath - This page, to come back to after logging in or signing up.
 * @param props.accept - Accepts the invite; redirects to the dashboard on success.
 * @returns The invite and the next step.
 */
export function InviteCard({
  invite,
  user,
  returnPath,
  accept,
}: {
  invite: InvitePreview;
  user: AuthUser | null;
  returnPath: string;
  accept: (state: AcceptInviteState) => Promise<AcceptInviteState>;
}) {
  const t = useTranslations("Invite");
  const [state, acceptAction, isPending] = useActionState(accept, INITIAL_STATE);
  const next = { next: returnPath };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title", { school: invite.school.name })}</h1>
      <p className="text-sm">{t("body", { role: t(`roles.${invite.role}`), email: invite.email })}</p>
      {user === null ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={{ pathname: "/login", query: next }}>{t("logIn")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={{ pathname: "/signup", query: next }}>{t("signUp")}</Link>
          </Button>
        </div>
      ) : user.email === invite.email ? (
        <form action={acceptAction} className="flex flex-col gap-3">
          <Button type="submit" disabled={isPending} className="self-start">
            {t(isPending ? "accepting" : "accept")}
          </Button>
          {state.status !== "idle" ? (
            <p role="alert" className="text-sm text-destructive">
              {t(`errors.${state.status}`)}
            </p>
          ) : null}
        </form>
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t("errors.mismatchSignedIn", { email: invite.email, current: user.email })}
        </p>
      )}
    </div>
  );
}
