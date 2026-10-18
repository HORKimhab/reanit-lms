import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import { Landing } from "@/components/marketing/landing";
import type { Locale } from "@/i18n/routing";

/**
 * Platform home page.
 *
 * @param props - Page props.
 * @param props.params - Route params with the locale.
 * @returns The landing page.
 */
export default function Home({ params }: PageProps<"/[locale]">) {
  // The layout has already rejected unknown locales.
  setRequestLocale(use(params).locale as Locale);
  return <Landing />;
}
