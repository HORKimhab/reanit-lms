import { outlineStats } from "@reanit/core/catalog";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";

import { CourseOgImage } from "@/components/course/course-og-image";
import { routing } from "@/i18n/routing";
import { loadOgFonts } from "@/server/og-fonts";
import { summarize } from "@/server/schools/course-metadata";
import { getSiteCourse, getSiteSchool } from "@/server/schools/site";

/** The share card size social networks expect. */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Longest title the card shows; three lines at its font size. */
const TITLE_MAX_LENGTH = 90;

/**
 * Draws the course's share card: school, title and lesson count, in the school's brand color.
 *
 * @param props - Image route props.
 * @param props.params - Route params with the locale, the school's subdomain and the course slug.
 * @returns The PNG.
 * @throws {Error} Next's not-found signal for an unknown course.
 */
export default async function CourseShareImage({ params }: { params: Promise<{ locale: string; school: string; course: string }> }) {
  const { locale: requested, school: subdomain, course: slug } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const [school, course, t] = await Promise.all([
    getSiteSchool(subdomain),
    getSiteCourse(subdomain, decodeURIComponent(slug)),
    getTranslations({ locale, namespace: "Course" }),
  ]);
  const title = summarize(course.title, TITLE_MAX_LENGTH);
  const details = t("ogLessons", { count: outlineStats(course).lessons });
  const fonts = await loadOgFonts(`${school.name}${title}${details}`);
  // An empty list would replace ImageResponse's own default font, so it is passed only when one loaded.
  return new ImageResponse(<CourseOgImage title={title} schoolName={school.name} details={details} brand={school.brand} />, {
    ...size,
    ...(fonts.length > 0 && { fonts }),
  });
}
