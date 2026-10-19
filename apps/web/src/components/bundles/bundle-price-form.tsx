"use client";

import { CURRENCIES, moneyFormat, type PriceInput } from "@reanit/core/commerce";
import { useTranslations } from "next-intl";

import { useCourseForm, type CourseFormAction } from "@/components/builder/use-course-form";
import { Field, INPUT_CLASS } from "@/components/form/field";
import { SubmitRow } from "@/components/form/submit-row";

/**
 * Sets a bundle's price, typed in major units ("49.50") with its currency.
 *
 * @param props - Component props.
 * @param props.price - The bundle's current price, or null.
 * @param props.action - Server action that saves the price, bound to the bundle.
 * @returns The amount and currency fields with a save button.
 */
export function BundlePriceForm({ price, action }: { price: PriceInput | null; action: CourseFormAction }) {
  const t = useTranslations("Bundles");
  const form = useTranslations("CourseForm");
  const { state, formAction, isPending, errorFor } = useCourseForm(action);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4" noValidate>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label={t("amount")} error={errorFor("amount", t("amountError"))}>
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
      <SubmitRow
        label={t("savePrice")}
        pendingLabel={form("saving")}
        isPending={isPending}
        savedMessage={state.status === "saved" ? form("saved") : undefined}
      />
    </form>
  );
}
