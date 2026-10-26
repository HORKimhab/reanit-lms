"use client";

import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { OfflinePaymentState } from "@/app/[locale]/s/[school]/(student)/checkout/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";

const IDLE: OfflinePaymentState = { status: "idle" };
/** Side of the school's QR image in CSS pixels, as large as a KHQR code. */
const QR_SIZE = 240;

/**
 * Shows the school's own payment QR image to scan and pay in a banking app, then takes the transaction
 * reference the app showed; the school confirms the payment once it sees the money.
 *
 * @param props - Component props.
 * @param props.qrImageUrl - The school's payment QR image.
 * @param props.priceLabel - The formatted amount to pay.
 * @param props.submit - Records the payment with its reference; bound to the order. Opens the order page on success.
 * @returns The QR image, the amount and the reference form.
 */
export function OfflinePayment({
  qrImageUrl,
  priceLabel,
  submit,
}: {
  qrImageUrl: string;
  priceLabel: string;
  submit: (state: OfflinePaymentState, formData: FormData) => Promise<OfflinePaymentState>;
}) {
  const t = useTranslations("Checkout");
  const [state, formAction, isPending] = useActionState(submit, IDLE);

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border p-6 text-center">
      <h2 className="font-semibold">{t("offlineTitle", { price: priceLabel })}</h2>
      {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage URL that changes, so Next's image cache cannot help */}
      <img src={qrImageUrl} alt={t("offlineQrLabel", { price: priceLabel })} width={QR_SIZE} height={QR_SIZE} className="rounded-lg bg-white object-contain" />
      <p className="text-sm text-muted-foreground">{t("offlineSteps")}</p>
      <form action={formAction} className="flex w-full flex-col gap-3 text-left">
        <Field label={t("reference")} hint={t("referenceHint")} error={state.status === "invalid" ? t("referenceError") : undefined}>
          {(control) => <input {...control} name="reference" required autoComplete="off" className={INPUT_CLASS} />}
        </Field>
        {state.status === "closed" ? (
          <p role="alert" className="text-sm text-destructive">
            {t("offlineClosed")}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? t("sendingPaid") : t("iPaid")}
        </Button>
      </form>
    </div>
  );
}
