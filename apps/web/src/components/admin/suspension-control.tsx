"use client";

import { SUSPENSION_REASON_MAX_LENGTH, type SchoolSuspension } from "@reanit/core/schools";
import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { SuspendState } from "@/app/[locale]/admin/actions";
import { ConfirmButton } from "@/components/form/confirm-button";
import { Field, INPUT_CLASS } from "@/components/form/field";

const IDLE: SuspendState = { status: "idle" };

/**
 * Takes a school offline with a reason, or brings a suspended school back online after asking twice.
 *
 * @param props - Component props.
 * @param props.suspension - The school's suspension, or null while it is online.
 * @param props.suspend - Takes it offline; bound to the school.
 * @param props.unsuspend - Brings it back online; bound to the school.
 * @returns A disclosure with the reason form, or the button that brings the school back.
 */
export function SuspensionControl({
  suspension,
  suspend,
  unsuspend,
}: {
  suspension: SchoolSuspension | null;
  suspend: (state: SuspendState, formData: FormData) => Promise<SuspendState>;
  unsuspend: () => Promise<void>;
}) {
  const t = useTranslations("Admin.schools");
  const [state, formAction, isPending] = useActionState(suspend, IDLE);

  if (suspension) {
    return (
      <ConfirmButton
        action={unsuspend}
        labels={{ trigger: t("unsuspend"), warning: t("unsuspendWarning"), confirm: t("unsuspendYes"), pending: t("saving"), cancel: t("cancel") }}
      />
    );
  }

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-destructive">{t("suspend")}</summary>
      <form action={formAction} className="mt-2 flex min-w-64 flex-col gap-2">
        <Field label={t("reason")} hint={t("reasonHint")} error={state.status === "invalid" ? t("reasonError") : undefined}>
          {(control) => <textarea {...control} name="reason" required rows={2} maxLength={SUSPENSION_REASON_MAX_LENGTH} className={`${INPUT_CLASS} h-auto py-2`} />}
        </Field>
        <Button type="submit" variant="destructive" size="sm" disabled={isPending} className="self-start">
          {isPending ? t("saving") : t("suspendYes")}
        </Button>
      </form>
    </details>
  );
}
