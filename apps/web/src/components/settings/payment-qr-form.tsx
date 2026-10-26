"use client";

import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { ImageUploadStart, PaymentQrState } from "@/app/[locale]/dashboard/settings/actions";
import { Field } from "@/components/form/field";

import { SettingsSection } from "./settings-section";
import { IMAGE_MAX_MB, IMAGE_TYPES, useImageChoice } from "./use-image-choice";

const INITIAL_STATE: PaymentQrState = { status: "idle" };
/** Side of the QR preview in CSS pixels. */
const PREVIEW_SIZE = 160;

/** The server actions the payment QR form calls. */
export type PaymentQrActions = {
  save: (state: PaymentQrState, formData: FormData) => Promise<PaymentQrState>;
  startUpload: (file: { contentType: string; sizeBytes: number }) => Promise<ImageUploadStart>;
};

/**
 * The school's own payment QR image (for example its bank's KHQR), which students scan to pay
 * subscriptions and payment plans offline; the school then confirms each payment. A new image goes
 * straight from the browser to storage when saved.
 *
 * @param props - Component props.
 * @param props.qrUrl - The saved image, or null.
 * @param props.actions - Saves the image's key (empty removes it), and presigns its upload.
 * @returns The section with the preview, the file picker, and save and remove buttons.
 */
export function PaymentQrForm({ qrUrl, actions }: { qrUrl: string | null; actions: PaymentQrActions }) {
  const t = useTranslations("PaymentQr");
  const image = useImageChoice(qrUrl);

  /**
   * Uploads the chosen image, if any, and saves its key; the remove button saves an empty key.
   *
   * @param previous - The form's last state.
   * @param formData - The submitted form; `intent` is `remove` for the remove button.
   * @returns The save's result, or why the image could not be uploaded.
   */
  async function submit(previous: PaymentQrState, formData: FormData): Promise<PaymentQrState> {
    if (formData.get("intent") !== "remove") {
      const upload = await image.upload(actions.startUpload);
      if (upload.status === "rejected") return { status: "invalid" };
      if (upload.status === "failed") return { status: "failed" };
      if (upload.status === "none") return previous;
      formData.set("paymentQrKey", upload.key);
    }
    const result = await actions.save(previous, formData);
    if (result.status === "saved") image.done();
    return result;
  }

  const [state, formAction, isPending] = useActionState(submit, INITIAL_STATE);
  const imageError = t("error", { maxMb: IMAGE_MAX_MB });

  return (
    <SettingsSection id="payment-qr" title={t("title")} intro={t("intro")}>
      <form action={formAction} className="flex flex-col gap-4">
        {image.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL or signed upload; next/image adds nothing
          <img src={image.previewUrl} alt={t("preview")} width={PREVIEW_SIZE} height={PREVIEW_SIZE} className="rounded-lg border bg-white object-contain" />
        ) : (
          <p className="text-sm text-muted-foreground">{t("none")}</p>
        )}
        <Field label={t("image")} hint={t("hint", { maxMb: IMAGE_MAX_MB })} error={image.isRejected || state.status === "invalid" ? imageError : undefined}>
          {(control) => (
            // No name: the image goes to storage, and only its key is posted.
            <input
              {...control}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              onChange={image.choose}
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" name="intent" value="save" disabled={isPending}>
            {isPending ? t("saving") : t("save")}
          </Button>
          {qrUrl ? (
            <Button type="submit" name="intent" value="remove" variant="outline" disabled={isPending}>
              {t("remove")}
            </Button>
          ) : null}
          <p role="status" className="text-sm text-muted-foreground">
            {state.status === "saved" ? t("saved") : null}
            {state.status === "failed" ? <span className="text-destructive">{t("failed")}</span> : null}
          </p>
        </div>
      </form>
    </SettingsSection>
  );
}
