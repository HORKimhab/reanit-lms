"use client";

import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { AuthFormState } from "@/app/[locale]/(auth)/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";

const INITIAL_STATE: AuthFormState = { status: "idle", invalidFields: [] };

/** A field an auth form can ask for. */
type AuthField = "name" | "email" | "password";

/** Which form to show; each mode has its own fields and submit label. */
export type AuthMode = "logIn" | "signUp" | "magicLink";

const MODE_FIELDS: Record<AuthMode, readonly AuthField[]> = {
  logIn: ["email", "password"],
  signUp: ["name", "email", "password"],
  magicLink: ["email"],
};

const INPUT_ATTRIBUTES: Record<AuthField, { type: string; autoComplete: string }> = {
  name: { type: "text", autoComplete: "name" },
  email: { type: "email", autoComplete: "email" },
  password: { type: "password", autoComplete: "current-password" },
};

/** Password length limits, shown and enforced on sign-up. */
export type PasswordRules = { min: number; max: number };

/**
 * Log-in, sign-up or magic-link form. Shows field errors, wrong credentials and
 * "link sent" from the action's result, and passes `next` through for the redirect.
 *
 * @param props - Component props.
 * @param props.mode - Which form to render.
 * @param props.action - Server action for that form.
 * @param props.next - Where to go after signing in, if not home.
 * @param props.passwordRules - Required for `signUp`: length limits for a new password.
 * @returns The form.
 */
export function AuthForm({
  mode,
  action,
  next,
  passwordRules,
}: {
  mode: AuthMode;
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  next?: string;
  passwordRules?: PasswordRules;
}) {
  const t = useTranslations("Auth");
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  /**
   * Gives a field's error message from the last submit.
   *
   * @param field - The field.
   * @returns The message, or `undefined` when the field is valid.
   */
  function errorFor(field: AuthField) {
    if (!state.invalidFields.includes(field)) return undefined;
    if (field === "email" && state.status === "emailTaken") return t("errors.emailTaken");
    if (field === "password" && passwordRules) return t("errors.newPassword", passwordRules);
    return t(`errors.${field}`);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {MODE_FIELDS[mode].map((field) => (
        <Field key={field} label={t(`fields.${field}`)} error={errorFor(field)}>
          {(control) => (
            <input
              {...control}
              {...INPUT_ATTRIBUTES[field]}
              {...(field === "password" && passwordRules
                ? { autoComplete: "new-password", minLength: passwordRules.min, maxLength: passwordRules.max }
                : {})}
              name={field}
              required
              className={INPUT_CLASS}
            />
          )}
        </Field>
      ))}
      {state.status === "invalidCredentials" ? (
        <p role="alert" className="text-sm text-destructive">
          {t("errors.invalidCredentials")}
        </p>
      ) : null}
      {state.status === "sent" ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("magicLink.sent")}
        </p>
      ) : null}
      <Button type="submit" variant={mode === "magicLink" ? "outline" : "default"} disabled={isPending}>
        {isPending ? t("submitting") : t(`${mode}.submit`)}
      </Button>
    </form>
  );
}
