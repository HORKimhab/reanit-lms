"use client";

import { DEFAULT_BRAND_COLOR, SCHOOL_IMAGE_RULES, SCHOOL_NAME_MAX_LENGTH, type School } from "@reanit/core/schools";
import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type * as React from "react";

import type { LogoUploadStart, SettingsField, SettingsState } from "@/app/[locale]/dashboard/settings/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";

import { BrandPreview } from "./brand-preview";

const INITIAL_STATE: SettingsState = { status: "idle", invalidFields: [] };
const BYTES_PER_MB = 1024 * 1024;
const LOGO_TYPES = Object.keys(SCHOOL_IMAGE_RULES.contentTypes);
const LOGO_MAX_MB = SCHOOL_IMAGE_RULES.maxBytes / BYTES_PER_MB;

/** The server actions the settings form calls. */
export type SettingsActions = {
  save: (state: SettingsState, formData: FormData) => Promise<SettingsState>;
  startLogoUpload: (file: { contentType: string; sizeBytes: number }) => Promise<LogoUploadStart>;
};

/**
 * Checks a logo file's type and size before previewing it, as the API will when it is uploaded.
 *
 * @param file - The chosen file.
 * @param file.type - Its media type.
 * @param file.size - Its size in bytes.
 * @returns Whether the file can be used as a logo.
 */
function isAllowedLogo({ type, size }: { type: string; size: number }) {
  return LOGO_TYPES.includes(type) && size <= SCHOOL_IMAGE_RULES.maxBytes;
}

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
  const [logoUrl, setLogoUrl] = useState(school.logoUrl ?? undefined);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isLogoRejected, setIsLogoRejected] = useState(false);

  /**
   * Uploads the chosen logo, if any, then saves the form with the logo's key.
   *
   * @param previous - The form's last state.
   * @param formData - The submitted form.
   * @returns The save's result, or why the logo could not be uploaded.
   */
  async function submit(previous: SettingsState, formData: FormData): Promise<SettingsState> {
    if (logoFile) {
      const started = await actions.startLogoUpload({ contentType: logoFile.type, sizeBytes: logoFile.size });
      if (started.status !== "ready") return { status: "invalid", invalidFields: ["logo"] };
      const stored = await fetch(started.url, { method: "PUT", headers: started.headers, body: logoFile }).catch(() => undefined);
      if (!stored?.ok) return { status: "failed", invalidFields: [] };
      formData.set("logoKey", started.key);
    }
    const result = await actions.save(previous, formData);
    if (result.status === "saved") setLogoFile(null);
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

  /**
   * Previews a chosen logo and keeps it for the next save, or clears the choice and shows an error when the file is not allowed.
   *
   * @param event - The file input's change event.
   */
  function chooseLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!isAllowedLogo(file)) {
      input.value = "";
      setIsLogoRejected(true);
      return;
    }
    setIsLogoRejected(false);
    setLogoFile(file);
    const reader = new FileReader();
    reader.addEventListener("load", () => setLogoUrl(String(reader.result)));
    reader.readAsDataURL(file);
  }

  const logoError = t("errors.logo", { maxMb: LOGO_MAX_MB });

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
          hint={t("logoHint", { maxMb: LOGO_MAX_MB })}
          error={isLogoRejected ? logoError : errorFor("logo", logoError)}
        >
          {(control) => (
            // No name: the image goes to storage, and only its key is posted.
            <input
              {...control}
              type="file"
              accept={LOGO_TYPES.join(",")}
              onChange={chooseLogo}
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
      <BrandPreview name={name} brand={brand} logoUrl={logoUrl} />
    </form>
  );
}
