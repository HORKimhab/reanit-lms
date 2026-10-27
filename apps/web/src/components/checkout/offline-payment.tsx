"use client";

import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { OfflinePaymentState } from "@/app/[locale]/s/[school]/(student)/checkout/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";

const IDLE: OfflinePaymentState = { status: "idle" };
/** Side of the school's QR image in CSS pixels, as large as a KHQR code. */
const QR_SIZE = 240;

/** Wording that names who is paid and who checks the payment, for a QR other than the school's. */
export type OfflinePaymentCopy = { qrLabel: string; steps: string; closed: string };

/**
 * Shows a payment QR image to scan and pay in a banking app, then takes the transaction reference the
 * app showed; whoever owns the QR confirms the payment once they see the money. By default it is the
 * school's QR for a student's order.
 *
 * @param props - Component props.
 * @param props.qrImageUrl - The payment QR image.
 * @param props.priceLabel - The formatted amount to pay.
 * @param props.submit - Records the payment with its reference; bound to the payment. Leaves the page on success.
 * @param props.copy - The QR's alt text, the steps and the closed message, when it is not the school's QR.
 * @returns The QR image, the amount and the reference form.
 */
export function OfflinePayment({
  qrImageUrl,
  priceLabel,
  submit,
  copy,
}: {
  qrImageUrl: string;
  priceLabel: string;
  submit: (state: OfflinePaymentState, formData: FormData) => Promise<OfflinePaymentState>;
  copy?: OfflinePaymentCopy;
}) {
  const t = useTranslations("Checkout");
  const [state, formAction, isPending] = useActionState(submit, IDLE);
  const { qrLabel, steps, closed } = copy ?? { qrLabel: t("offlineQrLabel", { price: priceLabel }), steps: t("offlineSteps"), closed: t("offlineClosed") };

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border p-6 text-center">
      <h2 className="font-semibold">{t("offlineTitle", { price: priceLabel })}</h2>
      {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage URL that changes, so Next's image cache cannot help */}
      <img src={qrImageUrl} alt={qrLabel} width={QR_SIZE} height={QR_SIZE} className="rounded-lg bg-white object-contain" />
      <p className="text-sm text-muted-foreground">{steps}</p>
      <form action={formAction} className="flex w-full flex-col gap-3 text-left">
        <Field label={t("reference")} hint={t("referenceHint")} error={state.status === "invalid" ? t("referenceError") : undefined}>
          {(control) => <input {...control} name="reference" required autoComplete="off" className={INPUT_CLASS} />}
        </Field>
        {state.status === "closed" ? (
          <p role="alert" className="text-sm text-destructive">
            {closed}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? t("sendingPaid") : t("iPaid")}
        </Button>
      </form>
    </div>
  );
}
