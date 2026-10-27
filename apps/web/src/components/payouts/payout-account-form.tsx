"use client";

import { PAYOUT_ACCOUNT_MAX_LENGTH, PAYOUT_TEXT_MAX_LENGTH, type PayoutAccount } from "@reanit/core/commerce";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { PayoutAccountState } from "@/app/[locale]/dashboard/payouts/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";
import { saveButtonProps, SubmitRow } from "@/components/form/submit-row";
import { SettingsSection } from "@/components/settings/settings-section";

const INITIAL_STATE: PayoutAccountState = { status: "idle" };

/**
 * The owner's form for where the school's payouts are sent: the account holder, the bank, and the
 * account number or Bakong ID.
 *
 * @param props - Component props.
 * @param props.account - The details as last saved, or null before the first save.
 * @param props.save - Saves the form.
 * @returns The payout details section.
 */
export function PayoutAccountForm({
  account,
  save,
}: {
  account: PayoutAccount | null;
  save: (state: PayoutAccountState, formData: FormData) => Promise<PayoutAccountState>;
}) {
  const t = useTranslations("Payouts");
  const [state, formAction, isPending] = useActionState(save, INITIAL_STATE);
  const error = state.status === "invalid" ? t("invalid", { max: PAYOUT_TEXT_MAX_LENGTH, accountMax: PAYOUT_ACCOUNT_MAX_LENGTH }) : undefined;

  return (
    <SettingsSection id="payout-account" title={t("accountTitle")} intro={t(account ? "accountIntro" : "accountMissing")}>
      <form action={formAction} className="flex flex-col gap-4">
        <Field label={t("holderName")} error={error}>
          {(control) => (
            <input {...control} name="holderName" required maxLength={PAYOUT_TEXT_MAX_LENGTH} defaultValue={account?.holderName} className={INPUT_CLASS} />
          )}
        </Field>
        <Field label={t("bankName")} hint={t("bankHint")}>
          {(control) => <input {...control} name="bankName" required maxLength={PAYOUT_TEXT_MAX_LENGTH} defaultValue={account?.bankName} className={INPUT_CLASS} />}
        </Field>
        <Field label={t("account")}>
          {(control) => <input {...control} name="account" required maxLength={PAYOUT_ACCOUNT_MAX_LENGTH} defaultValue={account?.account} className={INPUT_CLASS} />}
        </Field>
        <SubmitRow {...saveButtonProps(t, isPending, state.status === "saved")} />
      </form>
    </SettingsSection>
  );
}
