import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { CourseDetails } from "@/components/course/course-details";
import { routing } from "@/i18n/routing";
import { getOffer } from "@/server/commerce/checkout";
import { getRootDomain } from "@/server/env";
import { getRequestSite } from "@/server/request-site";
import { courseMetadata } from "@/server/schools/course-metadata";
import { schoolSitePath } from "@/server/schools/host";
import { getSiteCourse, getSiteSchool } from "@/server/schools/site";

/**
 * The sales page's title, description, canonical URL and share card, from the course.
 *
 * @param props - Metadata props.
 * @param props.params - Route params with the locale, the school's subdomain and the course slug.
 * @returns The metadata.
 * @throws {Error} Next's not-found signal for an unknown course.
 */
export async function generateMetadata({ params }: Pick<PageProps<"/[locale]/s/[school]/courses/[course]">, "params">): Promise<Metadata> {
  const { locale: requested, school: subdomain, course: slug } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const [school, course, t, { host, origin }] = await Promise.all([
    getSiteSchool(subdomain),
    getSiteCourse(subdomain, decodeURIComponent(slug)),
    getTranslations({ locale, namespace: "Course" }),
    getRequestSite(),
  ]);
  return courseMetadata({
    course,
    schoolName: school.name,
    locale,
    origin,
    sitePath: schoolSitePath(host, subdomain, getRootDomain()),
    fallbackDescription: t("metaDescription", { school: school.name }),
  });
}

/**
 * Course sales page. Unknown and draft courses 404.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain and the course slug.
 * @returns The course's sales page.
 * @throws {Error} Next's not-found signal when the school sells no course with that slug.
 */
export default async function CoursePage({ params }: PageProps<"/[locale]/s/[school]/courses/[course]">) {
  const { school: subdomain, course: slug } = await params;
  const courseSlug = decodeURIComponent(slug);
  const [school, course, offer] = await Promise.all([getSiteSchool(subdomain), getSiteCourse(subdomain, courseSlug), getOffer(subdomain, courseSlug)]);
  return (
    <CourseDetails
      course={course}
      instructorName={school.ownerName ?? school.name}
      price={offer.price}
      checkoutHref={`/s/${subdomain}/checkout/${course.slug}`}
    />
  );
}
