"use client";

import type { NotificationKind } from "@reanit/core/notifications";
import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { UnsubscribeState } from "@/app/[locale]/(auth)/unsubscribe/actions";

const INITIAL_STATE: UnsubscribeState = { status: "idle" };

/**
 * Asks to confirm stopping one kind of staff email, then says it is done or that the link is not valid.
 *
 * @param props - Component props.
 * @param props.link - The unsubscribe link's token and kind of email; null when the link is malformed.
 * @param props.action - Stops the emails.
 * @returns The confirmation, or the result.
 */
export function UnsubscribeForm({
  link,
  action,
}: {
  link: { token: string; kind: NotificationKind } | null;
  action: (state: UnsubscribeState, formData: FormData) => Promise<UnsubscribeState>;
}) {
  const t = useTranslations("Unsubscribe");
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  if (!link || state.status === "invalid") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t("invalidTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("invalid")}</p>
      </div>
    );
  }

  const kind = t(`kind.${link.kind}`);
  if (state.status === "done") {
    return (
      <div role="status" className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t("doneTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("done", { kind, school: state.schoolName })}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title", { kind })}</h1>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <input type="hidden" name="token" value={link.token} />
      <input type="hidden" name="kind" value={link.kind} />
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? t("stopping") : t("stop")}
      </Button>
    </form>
  );
}
