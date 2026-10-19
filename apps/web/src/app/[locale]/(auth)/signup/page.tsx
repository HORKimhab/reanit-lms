import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@reanit/core/auth";
import { setRequestLocale } from "next-intl/server";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthPanel } from "@/components/auth/auth-panel";
import type { Locale } from "@/i18n/routing";
import { nextFromQuery } from "@/server/auth/redirect";
import { redirectIfSignedIn } from "@/server/auth/session";

import { signUp } from "../actions";

const PASSWORD_RULES = { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH };

/**
 * Create a password account.
 *
 * @param props - Page props.
 * @param props.params - Route params with the locale.
 * @param props.searchParams - `next`: where to go after signing up.
 * @returns The sign-up form.
 */
export default async function SignUpPage({ params, searchParams }: PageProps<"/[locale]/signup">) {
  // The root layout has already rejected unknown locales.
  setRequestLocale((await params).locale as Locale);
  const next = nextFromQuery((await searchParams).next);
  await redirectIfSignedIn(next);

  return (
    <AuthPanel mode="signUp" next={next}>
      <AuthForm mode="signUp" action={signUp} next={next} passwordRules={PASSWORD_RULES} />
    </AuthPanel>
  );
}
