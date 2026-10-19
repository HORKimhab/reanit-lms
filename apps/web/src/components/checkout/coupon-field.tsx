"use client";

import type { Discount } from "@reanit/core/commerce";
import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type * as React from "react";

import type { CouponCheck } from "@/app/[locale]/s/[school]/(student)/checkout/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";

/**
 * A coupon code box inside the checkout form: the student applies a code to see what it takes off,
 * and the applied code is posted with the payment as `couponCode`.
 *
 * @param props - Component props.
 * @param props.applied - The discount of the applied coupon, or null.
 * @param props.formatMoney - Formats an amount in the course's currency.
 * @param props.checkCoupon - Checks a code against the course's price; bound to the school and course.
 * @param props.onChange - Receives the new discount when a code is applied, or null when it is removed.
 * @returns The code box with its Apply button, or the applied coupon with a Remove button.
 */
export function CouponField({
  applied,
  formatMoney,
  checkCoupon,
  onChange,
}: {
  applied: Discount | null;
  formatMoney: (amount: number) => string;
  checkCoupon: (code: string) => Promise<CouponCheck>;
  onChange: (discount: Discount | null) => void;
}) {
  const t = useTranslations("Checkout");
  const [code, setCode] = useState("");
  const [isInvalid, setIsInvalid] = useState(false);
  const [isChecking, startChecking] = useTransition();

  /** Checks the typed code and applies it when it can be used. */
  function apply() {
    if (!code.trim()) return;
    startChecking(async () => {
      const result = await checkCoupon(code);
      setIsInvalid(result.status === "invalid");
      if (result.status === "applied") onChange(result.discount);
    });
  }

  /**
   * Applies the code on Enter instead of submitting the payment form.
   *
   * @param event - The key press in the code box.
   */
  function applyOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    apply();
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3 text-sm">
        <input type="hidden" name="couponCode" value={applied.code} />
        <p role="status">{t("couponApplied", { code: applied.code, discount: formatMoney(applied.amountOff) })}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          {t("removeCoupon")}
        </Button>
      </div>
    );
  }

  return (
    <Field label={t("couponLabel")} error={isInvalid ? t("couponInvalid") : undefined}>
      {(control) => (
        <div className="flex gap-2">
          <input
            {...control}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={applyOnEnter}
            autoComplete="off"
            className={`${INPUT_CLASS} flex-1 uppercase`}
          />
          <Button type="button" variant="outline" disabled={isChecking} onClick={apply}>
            {isChecking ? t("applyingCoupon") : t("applyCoupon")}
          </Button>
        </div>
      )}
    </Field>
  );
}
