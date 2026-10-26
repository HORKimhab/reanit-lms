import { unsubscribeSchema } from "@reanit/core/notifications";
import { setRequestLocale } from "next-intl/server";

import { UnsubscribeForm } from "@/components/notifications/unsubscribe-form";
import type { Locale } from "@/i18n/routing";

import { unsubscribe } from "./actions";

/**
 * Where a staff email's unsubscribe link lands: confirms stopping that kind of email, signed in or not.
 *
 * @param props - Page props.
 * @param props.params - Route params with the locale.
 * @param props.searchParams - `token` and `kind` from the link.
 * @returns The confirmation, or a notice that the link is not valid.
 */
export default async function UnsubscribePage({ params, searchParams }: PageProps<"/[locale]/unsubscribe">) {
  // The root layout has already rejected unknown locales.
  setRequestLocale((await params).locale as Locale);
  const parsed = unsubscribeSchema.safeParse(await searchParams);
  return <UnsubscribeForm link={parsed.success ? parsed.data : null} action={unsubscribe} />;
}
