import { useTranslations } from "next-intl";
import type * as React from "react";

import { Link } from "@/i18n/navigation";

/** Login-page error codes this panel knows how to explain. */
const ERROR_MESSAGES = { "invalid-link": "errors.invalidLink" } as const;

const SWITCH_PATH = { logIn: "/signup", signUp: "/login" } as const;

/**
 * Frame for the log-in and sign-up pages: heading, an error from the URL, the forms,
 * and a link to the other page that keeps `next`.
 *
 * @param props - Component props.
 * @param props.mode - Which page this is.
 * @param props.next - Post-sign-in path to carry over to the other page.
 * @param props.error - `error` from the URL; unknown codes are ignored.
 * @param props.children - The page's forms.
 * @returns The panel.
 */
export function AuthPanel({
  mode,
  next,
  error,
  children,
}: {
  mode: "logIn" | "signUp";
  next?: string;
  error?: string | string[];
  children: React.ReactNode;
}) {
  const t = useTranslations("Auth");
  const errorKey = typeof error === "string" && Object.hasOwn(ERROR_MESSAGES, error)
    ? ERROR_MESSAGES[error as keyof typeof ERROR_MESSAGES]
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t(`${mode}.title`)}</h1>
      {errorKey ? (
        <p role="alert" className="rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive">
          {t(errorKey)}
        </p>
      ) : null}
      {children}
      <p className="text-sm text-muted-foreground">
        {t(`${mode}.switchPrompt`)}{" "}
        <Link
          href={{ pathname: SWITCH_PATH[mode], query: next ? { next } : {} }}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {t(`${mode}.switchLink`)}
        </Link>
      </p>
    </div>
  );
}

/**
 * Separates the password form from the magic-link form.
 *
 * @returns A labelled divider.
 */
export function OrDivider() {
  const t = useTranslations("Auth");
  return (
    <div role="separator" className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {t("or")}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
