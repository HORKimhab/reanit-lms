/** Languages emails are written in: the web app's locales. */
export const EMAIL_LOCALES = ["en", "km"] as const;

/** A language an email can be written in. */
export type EmailLocale = (typeof EMAIL_LOCALES)[number];

/** The web app's locale whose URLs carry no prefix (`/s/…` rather than `/en/s/…`). */
const UNPREFIXED_LOCALE: EmailLocale = "en";

/**
 * Builds the absolute URL of a school-site page in the reader's language, for links in emails.
 *
 * @param page Where the page is.
 * @param page.appUrl Public origin of the web app.
 * @param page.locale The reader's language; English URLs have no locale prefix.
 * @param page.subdomain The school's subdomain.
 * @param page.path Path inside the school site, starting with a slash.
 * @returns The URL.
 * @example
 * schoolPageUrl({ appUrl: "https://reanit.com", locale: "km", subdomain: "angkor", path: "/my-courses" });
 * // "https://reanit.com/km/s/angkor/my-courses"
 */
export function schoolPageUrl({ appUrl, locale, subdomain, path }: { appUrl: string; locale: EmailLocale; subdomain: string; path: string }): string {
  const prefix = locale === UNPREFIXED_LOCALE ? "" : `/${locale}`;
  return new URL(`${prefix}/s/${subdomain}${path}`, appUrl).href;
}
