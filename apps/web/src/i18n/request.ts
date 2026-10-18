import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

/**
 * Resolves the request's locale (falling back to the default) and loads its messages.
 *
 * @param params - next-intl request info.
 * @param params.requestLocale - The locale from the URL segment, if any.
 * @returns The locale and its message catalog.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
