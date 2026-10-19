"use client";

import { COUPON_CODE_MAX_LENGTH, CURRENCIES, MAX_PERCENT_OFF, type Currency } from "@reanit/core/commerce";
import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import type { CouponField, CouponFormState } from "@/app/[locale]/dashboard/coupons/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";
import { END_OF_DAY, localDayToIso } from "@/components/form/local-day";

const INITIAL_STATE: CouponFormState = { status: "idle", invalidFields: [] };
/**
 * Creates a coupon: its code, a percent or an amount off in one currency, an optional last day and
 * an optional usage limit.
 *
 * @param props - Component props.
 * @param props.action - Creates the coupon.
 * @returns The new-coupon form.
 */
export function CouponForm({ action }: { action: (state: CouponFormState, formData: FormData) => Promise<CouponFormState> }) {
  const t = useTranslations("Coupons");
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [currency, setCurrency] = useState<Currency>("USD");

  /**
   * Sends the form with the last day as the moment it ends in the creator's time zone.
   *
   * @param previous - The form's last state.
   * @param formData - The submitted form.
   * @returns The create's result.
   */
  async function submit(previous: CouponFormState, formData: FormData): Promise<CouponFormState> {
    const lastDay = String(formData.get("expiresAt") ?? "");
    // A coupon's last day counts in full; a value that is not a date goes on as typed, and the server rejects it.
    if (lastDay) formData.set("expiresAt", localDayToIso(lastDay, END_OF_DAY) ?? lastDay);
    return action(previous, formData);
  }

  const [state, formAction, isPending] = useActionState(submit, INITIAL_STATE);

  /**
   * Gives a field's error message when the last create rejected it.
   *
   * @param field - The field.
   * @returns The message, or `undefined` when the field is valid.
   */
  function errorFor(field: CouponField) {
    return state.invalidFields.includes(field) ? t(`errors.${field}`) : undefined;
  }

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">{t("newTitle")}</h2>
      <Field label={t("code")} hint={t("codeHint")} error={errorFor("code")}>
        {(control) => <input {...control} name="code" required maxLength={COUPON_CODE_MAX_LENGTH} autoComplete="off" className={`${INPUT_CLASS} uppercase`} />}
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("kind")}</legend>
        <div className="flex flex-wrap gap-4">
          {(["percent", "fixed"] as const).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input type="radio" name="kind" value={option} checked={kind === option} onChange={() => setKind(option)} className="accent-primary" />
              {t(`kinds.${option}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {kind === "percent" ? (
        <Field label={t("percentOff")} error={errorFor("percentOff")}>
          {(control) => <input {...control} name="percentOff" type="number" required min={1} max={MAX_PERCENT_OFF} step={1} className={INPUT_CLASS} />}
        </Field>
      ) : (
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label={t("amountOff")} error={errorFor("amountOff")}>
            {(control) => <input {...control} name="amountOff" required inputMode="decimal" className={INPUT_CLASS} />}
          </Field>
          <Field label={t("currency")}>
            {(control) => (
              <select
                {...control}
                name="currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value as Currency)}
                className={INPUT_CLASS}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      )}
      <Field label={t("expiresAt")} hint={t("expiresHint")} error={errorFor("expiresAt")}>
        {(control) => <input {...control} name="expiresAt" type="date" className={INPUT_CLASS} />}
      </Field>
      <Field label={t("maxRedemptions")} hint={t("maxRedemptionsHint")} error={errorFor("maxRedemptions")}>
        {(control) => <input {...control} name="maxRedemptions" type="number" min={1} step={1} className={INPUT_CLASS} />}
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? t("creating") : t("create")}
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {state.status === "created" ? t("created") : null}
        </p>
      </div>
    </form>
  );
}
