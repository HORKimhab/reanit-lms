"use client";

import { BILLING_INTERVALS, type BillingInterval, type PaymentMethod } from "@reanit/core/commerce";
import { PAID_PLANS, PLAN_CURRENCY, PLAN_TERMS, type PaidPlan } from "@reanit/core/schools";
import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import type { PlanCheckoutState } from "@/app/[locale]/dashboard/plan/actions";
import type { OfflinePaymentState } from "@/app/[locale]/s/[school]/(student)/checkout/actions";
import { GatewayStepView } from "@/components/checkout/gateway-step-view";
import { OfflinePayment } from "@/components/checkout/offline-payment";
import { RadioChoice } from "@/components/form/radio-choice";
import { useMoney } from "@/i18n/format";
import type { PlanPaymentStatus } from "@/server/schools/plan";

const IDLE: PlanCheckoutState = { status: "idle" };

/**
 * Pays the platform for a period of a plan: pick the plan, a month or a year, and how to pay; then the
 * gateway's step follows (a PayWay form, or a KHQR code to scan), or the platform's QR with the transfer's
 * reference. Paying the plan the school is on extends it.
 *
 * @param props - Component props.
 * @param props.methods - The methods a plan can be paid with, the default first.
 * @param props.current - The school's paid plan, picked to start with; Pro otherwise.
 * @param props.action - Starts the plan payment.
 * @param props.checkStatus - Reads a plan payment's status while its KHQR code is shown.
 * @param props.submitTransfer - Records the owner's reference for a transfer to the platform's QR; bound to the payment here.
 * @param props.paymentHref - Builds the page that shows a payment's outcome.
 * @returns The plan, period and method pickers with the pay button, or the step that follows them.
 */
export function PlanCheckoutForm({
  methods,
  current,
  action,
  checkStatus,
  submitTransfer,
  paymentHref,
}: {
  methods: PaymentMethod[];
  current: PaidPlan | null;
  action: (state: PlanCheckoutState, formData: FormData) => Promise<PlanCheckoutState>;
  checkStatus: (paymentId: string) => Promise<PlanPaymentStatus>;
  submitTransfer: (paymentId: string, state: OfflinePaymentState, formData: FormData) => Promise<OfflinePaymentState>;
  paymentHref: (paymentId: string) => string;
}) {
  const t = useTranslations("Plans");
  const checkout = useTranslations("Checkout");
  const money = useMoney();
  const [plan, setPlan] = useState<PaidPlan>(current ?? "pro");
  const [period, setPeriod] = useState<BillingInterval>("month");
  const [state, submit, isPending] = useActionState(action, IDLE);
  // Paid plans always have prices.
  const priceLabel = money(PLAN_TERMS[plan].prices![period], PLAN_CURRENCY);

  if (state.status === "form" || state.status === "qr") {
    return <GatewayStepView step={state} priceLabel={priceLabel} waitHref={paymentHref(state.paymentId)} checkStatus={() => checkStatus(state.paymentId)} />;
  }
  if (state.status === "offline") {
    const copy = { qrLabel: t("transfer.qrLabel", { price: priceLabel }), steps: t("transfer.steps"), closed: t("transfer.closed") };
    return <OfflinePayment qrImageUrl={state.qrImageUrl} priceLabel={priceLabel} submit={submitTransfer.bind(null, state.paymentId)} copy={copy} />;
  }
  if (methods.length === 0) return <p className="text-sm text-muted-foreground">{t("noMethods")}</p>;

  return (
    <form action={submit} className="flex max-w-md flex-col gap-4 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">{t("checkoutTitle")}</h2>
      <RadioChoice legend={t("plan")} name="plan" options={PAID_PLANS} value={plan} onChange={setPlan} labelOf={(option) => t(`names.${option}`)} />
      <RadioChoice legend={t("interval")} name="interval" options={BILLING_INTERVALS} value={period} onChange={setPeriod} labelOf={(option) => t(`intervals.${option}`)} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{checkout("methodLegend")}</legend>
        {methods.map((method, i) => (
          <label key={method} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-checked:border-primary">
            <input type="radio" name="method" value={method} defaultChecked={i === 0} className="accent-primary" />
            {checkout(`methods.${method}`)}
          </label>
        ))}
      </fieldset>
      {state.status === "unavailable" ? (
        <p role="alert" className="text-sm text-destructive">
          {checkout("unavailable")}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? checkout("paying") : checkout("pay", { price: priceLabel })}
      </Button>
    </form>
  );
}
