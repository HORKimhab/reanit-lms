import { z } from "zod";

import type { MembershipRole } from "../schools";

/** Languages emails are written in: the web app's locales. */
export const EMAIL_LOCALES = ["en", "km"] as const;

/** A language an email can be written in. */
export type EmailLocale = (typeof EMAIL_LOCALES)[number];

/** The web app's locale whose URLs carry no prefix (`/s/…` rather than `/en/s/…`). */
const UNPREFIXED_LOCALE: EmailLocale = "en";

/**
 * Builds the absolute URL of a web app page in the reader's language, for links in emails.
 *
 * @param page Where the page is.
 * @param page.appUrl Public origin of the web app.
 * @param page.locale The reader's language; English URLs have no locale prefix.
 * @param page.path Path of the page, starting with a slash; may carry a query.
 * @returns The URL.
 * @example
 * appPageUrl({ appUrl: "https://reanit.com", locale: "km", path: "/dashboard/comments" });
 * // "https://reanit.com/km/dashboard/comments"
 */
export function appPageUrl({ appUrl, locale, path }: { appUrl: string; locale: EmailLocale; path: string }): string {
  const prefix = locale === UNPREFIXED_LOCALE ? "" : `/${locale}`;
  return new URL(`${prefix}${path}`, appUrl).href;
}

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
  return appPageUrl({ appUrl, locale, path: `/s/${subdomain}${path}` });
}

/** Emails a school's staff get about it; each can be turned off on its own. */
export const NOTIFICATION_KINDS = ["newSale", "newComment", "courseCompleted"] as const;

/** One kind of staff email. */
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Who gets each kind: sales go to those who run the business, learning news to the instructors too. */
export const NOTIFICATION_ROLES: Record<NotificationKind, readonly MembershipRole[]> = {
  newSale: ["owner", "admin"],
  newComment: ["owner", "admin", "instructor"],
  courseCompleted: ["owner", "admin", "instructor"],
};

/** A staff member's email settings for one school: each kind on or off, and the language they are written in. */
export const notificationPreferencesSchema = z.object({
  newSale: z.boolean(),
  newComment: z.boolean(),
  courseCompleted: z.boolean(),
  locale: z.enum(EMAIL_LOCALES),
});

/** Parsed email settings. */
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

/** Settings of a staff member who never changed them: every email, in English. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = { newSale: true, newComment: true, courseCompleted: true, locale: "en" };

/** An unsubscribe link's query: the staff member's secret token and the kind of email to stop. */
export const unsubscribeSchema = z.object({ token: z.uuid(), kind: z.enum(NOTIFICATION_KINDS) });

/** Parsed unsubscribe request. */
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;
