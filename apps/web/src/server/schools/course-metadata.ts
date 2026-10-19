import type { CourseWithOutline } from "@reanit/core/catalog";
import type { Metadata } from "next";

import { routing, type Locale } from "@/i18n/routing";

/** Longest description search engines show in full. */
const DESCRIPTION_MAX_LENGTH = 160;
const ELLIPSIS = "…";

/** Open Graph locale codes for the app's locales. */
const OG_LOCALES: Record<Locale, string> = { en: "en_US", km: "km_KH" };

/**
 * Shortens text to a length, at a word boundary when there is one, for descriptions and share images.
 *
 * @param text The text; runs of whitespace become one space.
 * @param maxLength The longest result, ellipsis included.
 * @returns The text as is when it fits, or cut with an ellipsis.
 */
export function summarize(text: string, maxLength: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= maxLength) return flat;
  const cut = flat.slice(0, maxLength - ELLIPSIS.length);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}${ELLIPSIS}`;
}

/**
 * Builds a course sales page's metadata: title, description, canonical and per-language URLs, and the share card.
 *
 * @param page What the page shows and where it lives.
 * @param page.course The course.
 * @param page.schoolName The school selling it.
 * @param page.locale The page's language.
 * @param page.origin Where the request was sent, e.g. `https://angkor.reanit.com`.
 * @param page.sitePath The school site's path on that origin: "" on its own subdomain, `/s/<subdomain>` elsewhere.
 * @param page.fallbackDescription Used when the course has no description.
 * @returns The metadata; the share image comes from the route's `opengraph-image`.
 */
export function courseMetadata({
  course,
  schoolName,
  locale,
  origin,
  sitePath,
  fallbackDescription,
}: {
  course: CourseWithOutline;
  schoolName: string;
  locale: Locale;
  origin: string;
  sitePath: string;
  fallbackDescription: string;
}): Metadata {
  /**
   * Gives the page's path in a language; English paths have no prefix.
   *
   * @param language The language.
   * @returns The path.
   */
  function pathIn(language: Locale) {
    return `${language === routing.defaultLocale ? "" : `/${language}`}${sitePath}/courses/${course.slug}`;
  }

  const description = summarize(course.description || fallbackDescription, DESCRIPTION_MAX_LENGTH);
  return {
    metadataBase: new URL(origin),
    title: `${course.title} | ${schoolName}`,
    description,
    alternates: {
      canonical: pathIn(locale),
      languages: Object.fromEntries(routing.locales.map((language) => [language, pathIn(language)])),
    },
    openGraph: { type: "website", url: pathIn(locale), title: course.title, description, siteName: schoolName, locale: OG_LOCALES[locale] },
    twitter: { card: "summary_large_image", title: course.title, description },
  };
}
