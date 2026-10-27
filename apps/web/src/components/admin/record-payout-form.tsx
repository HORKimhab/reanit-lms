"use client";

import { moneyFormat, PAYOUT_TEXT_MAX_LENGTH, type DuePayout } from "@reanit/core/commerce";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { RecordPayoutState } from "@/app/[locale]/admin/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";
import { isoToLocalDay, localDayToIso } from "@/components/form/local-day";
import { SubmitRow } from "@/components/form/submit-row";

const IDLE: RecordPayoutState = { status: "idle" };

/**
 * Records a transfer the admin made to a school: the amount, prefilled with what is due, the day it
 * was sent, in the admin's time zone, and the bank's reference.
 *
 * @param props - Component props.
 * @param props.due - The payout due.
 * @param props.record - Records the transfer.
 * @returns The form.
 */
export function RecordPayoutForm({ due, record }: { due: DuePayout; record: (state: RecordPayoutState, formData: FormData) => Promise<RecordPayoutState> }) {
  const t = useTranslations("Admin.payouts");

  /**
   * Sends the transfer's day as the start of that day in the admin's time zone.
   *
   * @param previous - The form's last state.
   * @param formData - The submitted form.
   * @returns The record's result.
   */
  async function submit(previous: RecordPayoutState, formData: FormData): Promise<RecordPayoutState> {
    formData.set("paidAt", localDayToIso(String(formData.get("paidOn"))) ?? "");
    return record(previous, formData);
  }

  const [state, formAction, isPending] = useActionState(submit, IDLE);
  const error = state.status === "invalid" || state.status === "exceeds" ? t(state.status) : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="schoolId" value={due.school.id} />
      <input type="hidden" name="currency" value={due.currency} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("amountIn", { currency: due.currency })} error={error}>
          {(control) => <input {...control} name="amount" required inputMode="decimal" defaultValue={String(moneyFormat(due.amount, due.currency).value)} className={INPUT_CLASS} />}
        </Field>
        <Field label={t("paidOn")}>
          {(control) => <input {...control} type="date" name="paidOn" required defaultValue={isoToLocalDay(new Date().toISOString())} className={INPUT_CLASS} />}
        </Field>
        <Field label={t("reference")}>
          {(control) => <input {...control} name="reference" required maxLength={PAYOUT_TEXT_MAX_LENGTH} autoComplete="off" className={INPUT_CLASS} />}
        </Field>
      </div>
      <SubmitRow label={t("record")} pendingLabel={t("saving")} isPending={isPending} savedMessage={state.status === "recorded" ? t("recorded") : undefined} />
    </form>
  );
}
