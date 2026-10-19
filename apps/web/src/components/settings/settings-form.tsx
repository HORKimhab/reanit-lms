"use client";

import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type * as React from "react";

import type { SettingsField, SettingsState } from "@/app/[locale]/dashboard/settings/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";
import {
  isAllowedLogo,
  LOGO_MAX_MB,
  LOGO_TYPES,
  SCHOOL_NAME_MAX_LENGTH,
  type MockSchool,
} from "@/mocks/schools";

import { BrandPreview } from "./brand-preview";

const INITIAL_STATE: SettingsState = { status: "idle", invalidFields: [] };

/**
 * School settings: name, brand color and logo, with a live preview that updates as they change.
 *
 * @param props - Component props.
 * @param props.school - The school as last saved.
 * @param props.action - Saves the form; returns which fields were invalid, if any.
 * @returns The form beside the preview.
 */
export function SettingsForm({
  school,
  action,
}: {
  school: MockSchool;
  action: (state: SettingsState, formData: FormData) => Promise<SettingsState>;
}) {
  const t = useTranslations("Settings");
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [name, setName] = useState(school.name);
  const [brand, setBrand] = useState(school.brand);
  const [logoUrl, setLogoUrl] = useState(school.logoUrl);
  const [isLogoRejected, setIsLogoRejected] = useState(false);

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
   * Previews a chosen logo, or clears the choice and shows an error when the file is not allowed.
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
            <input
              {...control}
              type="file"
              name="logo"
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
          </p>
        </div>
      </div>
      <BrandPreview name={name} brand={brand} logoUrl={logoUrl} />
    </form>
  );
}
