import { setRequestLocale } from "next-intl/server";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthPanel, OrDivider } from "@/components/auth/auth-panel";
import type { Locale } from "@/i18n/routing";
import { nextFromQuery } from "@/server/auth/redirect";
import { redirectIfSignedIn } from "@/server/auth/session";

import { logIn, requestMagicLink } from "../actions";

/**
 * Log in with a password or an emailed link.
 *
 * @param props - Page props.
 * @param props.params - Route params with the locale.
 * @param props.searchParams - `next` (where to go after) and `error` (from a failed magic link).
 * @returns Both sign-in forms.
 */
export default async function LogInPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  // The root layout has already rejected unknown locales.
  setRequestLocale((await params).locale as Locale);
  const query = await searchParams;
  const next = nextFromQuery(query.next);
  await redirectIfSignedIn(next);

  return (
    <AuthPanel mode="logIn" next={next} error={query.error}>
      <AuthForm mode="logIn" action={logIn} next={next} />
      <OrDivider />
      <AuthForm mode="magicLink" action={requestMagicLink} next={next} />
    </AuthPanel>
  );
}
