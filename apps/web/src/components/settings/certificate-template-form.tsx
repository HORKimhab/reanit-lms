"use client";

import { SIGNER_MAX_LENGTH, type CertificateTemplate } from "@reanit/core/learning";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { CertificateTemplateState } from "@/app/[locale]/dashboard/settings/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";
import { SubmitRow } from "@/components/form/submit-row";

const INITIAL_STATE: CertificateTemplateState = { status: "idle" };

/**
 * Certificate settings: who signs the school's certificates. Certificates issued after a save print the
 * signature block in the school's brand color; blank fields leave it off.
 *
 * @param props - Component props.
 * @param props.template - The template as last saved.
 * @param props.save - Saves the form.
 * @returns The certificate section of the settings page.
 */
export function CertificateTemplateForm({
  template,
  save,
}: {
  template: CertificateTemplate;
  save: (state: CertificateTemplateState, formData: FormData) => Promise<CertificateTemplateState>;
}) {
  const t = useTranslations("CertificateTemplate");
  const [state, formAction, isPending] = useActionState(save, INITIAL_STATE);
  const error = state.status === "invalid" ? t("tooLong", { max: SIGNER_MAX_LENGTH }) : undefined;

  return (
    <section aria-labelledby="certificate-template" className="flex max-w-xl flex-col gap-4 border-t pt-8">
      <div className="flex flex-col gap-1">
        <h2 id="certificate-template" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <Field label={t("signerName")} error={error}>
          {(control) => (
            <input {...control} name="signerName" maxLength={SIGNER_MAX_LENGTH} defaultValue={template.signerName ?? ""} className={INPUT_CLASS} />
          )}
        </Field>
        <Field label={t("signerTitle")} hint={t("signerTitleHint")}>
          {(control) => (
            <input {...control} name="signerTitle" maxLength={SIGNER_MAX_LENGTH} defaultValue={template.signerTitle ?? ""} className={INPUT_CLASS} />
          )}
        </Field>
        <SubmitRow label={t("save")} pendingLabel={t("saving")} isPending={isPending} savedMessage={state.status === "saved" ? t("saved") : undefined} />
      </form>
    </section>
  );
}
