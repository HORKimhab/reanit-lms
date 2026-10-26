"use client";

import { EMAIL_LOCALES, NOTIFICATION_KINDS, type NotificationKind, type NotificationPreferences } from "@reanit/core/notifications";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { NotificationPreferencesState } from "@/app/[locale]/dashboard/settings/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";
import { saveButtonProps, SubmitRow } from "@/components/form/submit-row";

import { SettingsSection } from "./settings-section";

const INITIAL_STATE: NotificationPreferencesState = { status: "idle" };

/** The anchor every staff email's settings link points at. */
const SECTION_ID = "notifications";

/**
 * The staff member's email settings: a checkbox per email their role gets, and the language emails are
 * written in. Emails their role does not get keep their saved value, so a later promotion finds them as left.
 *
 * @param props - Component props.
 * @param props.preferences - The settings as last saved.
 * @param props.kinds - The kinds of email the staff member's role gets.
 * @param props.save - Saves the form.
 * @returns The email section of the settings page.
 */
export function NotificationPreferencesForm({
  preferences,
  kinds,
  save,
}: {
  preferences: NotificationPreferences;
  kinds: readonly NotificationKind[];
  save: (state: NotificationPreferencesState, formData: FormData) => Promise<NotificationPreferencesState>;
}) {
  const t = useTranslations("NotificationPreferences");
  const [state, formAction, isPending] = useActionState(save, INITIAL_STATE);
  const keptKinds = NOTIFICATION_KINDS.filter((kind) => !kinds.includes(kind) && preferences[kind]);

  return (
    <SettingsSection id={SECTION_ID} title={t("title")} intro={t("intro")}>
      <form action={formAction} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t("kinds")}</legend>
          {kinds.map((kind) => (
            <label key={kind} className="flex items-start gap-2 rounded-lg border p-3 text-sm has-checked:border-primary">
              <input type="checkbox" name={kind} defaultChecked={preferences[kind]} className="mt-0.5 accent-primary" />
              <span className="flex flex-col">
                <span className="font-medium">{t(`kind.${kind}.label`)}</span>
                <span className="text-muted-foreground">{t(`kind.${kind}.hint`)}</span>
              </span>
            </label>
          ))}
          {keptKinds.map((kind) => (
            <input key={kind} type="hidden" name={kind} value="on" />
          ))}
        </fieldset>
        <Field label={t("locale")} error={state.status === "invalid" ? t("invalid") : undefined}>
          {(control) => (
            <select {...control} name="locale" defaultValue={preferences.locale} className={INPUT_CLASS}>
              {EMAIL_LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {t(`localeName.${locale}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <SubmitRow {...saveButtonProps(t, isPending, state.status === "saved")} />
      </form>
    </SettingsSection>
  );
}
