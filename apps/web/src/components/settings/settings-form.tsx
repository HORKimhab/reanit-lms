"use client";

import { DEFAULT_BRAND_COLOR, SCHOOL_NAME_MAX_LENGTH, type School } from "@reanit/core/schools";
import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import type { ImageUploadStart, SettingsField, SettingsState } from "@/app/[locale]/dashboard/settings/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";

import { BrandPreview } from "./brand-preview";
import { IMAGE_MAX_MB, IMAGE_TYPES, useImageChoice } from "./use-image-choice";

const INITIAL_STATE: SettingsState = { status: "idle", invalidFields: [] };

/** The server actions the settings form calls. */
export type SettingsActions = {
  save: (state: SettingsState, formData: FormData) => Promise<SettingsState>;
  startLogoUpload: (file: { contentType: string; sizeBytes: number }) => Promise<ImageUploadStart>;
};

/**
 * School settings: name, brand color and logo, with a live preview that updates as they change.
 * A new logo goes straight from the browser to storage when the form is saved.
 *
 * @param props - Component props.
 * @param props.school - The school as last saved.
 * @param props.actions - Saves the form, and presigns a logo upload.
 * @returns The form beside the preview.
 */
export function SettingsForm({ school, actions }: { school: School; actions: SettingsActions }) {
  const t = useTranslations("Settings");
  const [name, setName] = useState(school.name);
  const [brand, setBrand] = useState(school.brandColor ?? DEFAULT_BRAND_COLOR);
  const logo = useImageChoice(school.logoUrl);

  /**
   * Uploads the chosen logo, if any, then saves the form with the logo's key.
   *
   * @param previous - The form's last state.
   * @param formData - The submitted form.
   * @returns The save's result, or why the logo could not be uploaded.
   */
  async function submit(previous: SettingsState, formData: FormData): Promise<SettingsState> {
    const upload = await logo.upload(actions.startLogoUpload);
    if (upload.status === "rejected") return { status: "invalid", invalidFields: ["logo"] };
    if (upload.status === "failed") return { status: "failed", invalidFields: [] };
    if (upload.status === "uploaded") formData.set("logoKey", upload.key);
    const result = await actions.save(previous, formData);
    if (result.status === "saved") logo.done();
    return result;
  }

  const [state, formAction, isPending] = useActionState(submit, INITIAL_STATE);

  /**
   * Gives a field's error message when the last save rejected it.
   *
   * @param field - The field.
   * @param message - Its error message.
   * @returns The message, or `undefined` when the field is valid.
   */
  function errorFor(field: SettingsField, message: string) {
    return state.invalidFields.includes(field) ? message : undefined;
  }

  const logoError = t("errors.logo", { maxMb: IMAGE_MAX_MB });

  return (
    <form action={formAction} className="grid items-start gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        <Field label={t("name")} error={errorFor("name", t("errors.name", { max: SCHOOL_NAME_MAX_LENGTH }))}>
          {(control) => (
            <input
              {...control}
              name="name"
              required
              maxLength={SCHOOL_NAME_MAX_LENGTH}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={INPUT_CLASS}
            />
          )}
        </Field>
        <Field label={t("brand")} error={errorFor("brand", t("errors.brand"))}>
          {(control) => (
            <div className="flex items-center gap-3">
              <input
                {...control}
                type="color"
                name="brand"
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1"
              />
              <span className="font-mono text-sm text-muted-foreground">{brand}</span>
            </div>
          )}
        </Field>
        <Field
          label={t("logo")}
          hint={t("logoHint", { maxMb: IMAGE_MAX_MB })}
          error={logo.isRejected ? logoError : errorFor("logo", logoError)}
        >
          {(control) => (
            // No name: the image goes to storage, and only its key is posted.
            <input
              {...control}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              onChange={logo.choose}
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
            />
          )}
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? t("saving") : t("save")}
          </Button>
          <p role="status" className="text-sm text-muted-foreground">
            {state.status === "saved" ? t("saved") : null}
            {state.status === "failed" ? <span className="text-destructive">{t("errors.save")}</span> : null}
          </p>
        </div>
      </div>
      <BrandPreview name={name} brand={brand} logoUrl={logo.previewUrl} />
    </form>
  );
}
