"use client";

import { BILLING_INTERVALS, CURRENCIES, MAX_INSTALLMENTS, moneyFormat, type Billing, type PriceInput } from "@reanit/core/commerce";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useCourseForm, type CourseFormAction } from "@/components/builder/use-course-form";
import { Field, INPUT_CLASS } from "@/components/form/field";
import { RadioChoice } from "@/components/form/radio-choice";
import { SubmitRow } from "@/components/form/submit-row";

/** How a price can bill, in the order offered. */
const BILLING_KINDS: Billing["kind"][] = ["one_time", "recurring", "payment_plan"];
/** Fewest instalments a payment plan takes. */
const MIN_INSTALLMENTS = 2;
/** Instalments a new payment plan starts with. */
const DEFAULT_INSTALLMENTS = 3;

/**
 * Sets a course's or bundle's price: the amount typed in major units ("49.50") with its currency, and
 * how it bills: once, every month or year, or in a number of monthly payments.
 *
 * @param props - Component props.
 * @param props.price - The current price, or null.
 * @param props.action - Server action that saves the price, bound to the course or bundle.
 * @returns The amount, currency and billing fields with a save button.
 */
export function PriceForm({ price, action }: { price: PriceInput | null; action: CourseFormAction }) {
  const t = useTranslations("Pricing");
  const form = useTranslations("CourseForm");
  const { state, formAction, isPending, errorFor } = useCourseForm(action);
  const [kind, setKind] = useState<Billing["kind"]>(price?.billing.kind ?? "one_time");
  const billing = price?.billing;

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4" noValidate>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label={t(kind === "one_time" ? "amount" : kind === "recurring" ? "amountPerPeriod" : "amountPerInstallment")} error={errorFor("amount", t("amountError"))}>
          {(control) => (
            <input
              {...control}
              name="amount"
              inputMode="decimal"
              required
              defaultValue={price ? String(moneyFormat(price.amount, price.currency).value) : ""}
              className={INPUT_CLASS}
            />
          )}
        </Field>
        <Field label={t("currency")}>
          {(control) => (
            <select {...control} name="currency" defaultValue={price?.currency ?? CURRENCIES[0]} className={INPUT_CLASS}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <RadioChoice legend={t("billing")} name="billing" options={BILLING_KINDS} value={kind} onChange={setKind} labelOf={(option) => t(`kinds.${option}`)} />
      {kind === "recurring" ? (
        <Field label={t("interval")}>
          {(control) => (
            <select {...control} name="interval" defaultValue={billing?.kind === "recurring" ? billing.interval : "month"} className={INPUT_CLASS}>
              {BILLING_INTERVALS.map((interval) => (
                <option key={interval} value={interval}>
                  {t(`intervals.${interval}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
      ) : null}
      {kind === "payment_plan" ? (
        <Field label={t("installmentCount")} hint={t("installmentHint")} error={errorFor("installments", t("installmentsError", { max: MAX_INSTALLMENTS }))}>
          {(control) => (
            <input
              {...control}
              name="installments"
              type="number"
              required
              min={MIN_INSTALLMENTS}
              max={MAX_INSTALLMENTS}
              step={1}
              defaultValue={billing?.kind === "payment_plan" ? billing.installments : DEFAULT_INSTALLMENTS}
              className={INPUT_CLASS}
            />
          )}
        </Field>
      ) : null}
      <SubmitRow
        label={t("save")}
        pendingLabel={form("saving")}
        isPending={isPending}
        savedMessage={state.status === "saved" ? form("saved") : undefined}
      />
    </form>
  );
}
