import type { Course, CourseWithOutline } from "@reanit/core/catalog";
import type { School } from "@reanit/core/schools";
import { notFound } from "next/navigation";
import { cache } from "react";

import { DEFAULT_BRAND } from "@/components/shells/brand";
import type { MockSchool } from "@/mocks/schools";

import { getApi, unexpectedResponse } from "../api";

/** A school as its public site shows it. The tagline stays empty until the API stores one. */
export type SiteSchool = MockSchool & {
  /** Whose courses these are, shown as the instructor; null when the owner gave no name. */
  ownerName: string | null;
};

/**
 * Puts a school from the API in the shape the school shells and the dashboard mark show.
 *
 * @param school The school.
 * @returns Its subdomain as the slug, its brand color (or the default) and its logo, if any.
 */
export function toBrandedSchool(school: School): MockSchool {
  return {
    slug: school.subdomain,
    name: school.name,
    tagline: "",
    brand: school.brandColor ?? DEFAULT_BRAND,
    ...(school.logoUrl && { logoUrl: school.logoUrl }),
  };
}

/**
 * Turns an API answer for a public school page into the page's next step: a missing school or
 * course (or a subdomain no school could have) is a 404.
 *
 * @param response The API's response.
 * @throws {Error} Next's not-found signal, or an unexpected-response error.
 */
export function checkPublicResponse(response: Response) {
  if (response.ok) return;
  if (response.status === 404 || response.status === 400) notFound();
  throw unexpectedResponse(response);
}

/**
 * Resolves the school a subdomain belongs to. Cached per request, so the layouts and the page share one call.
 *
 * @param subdomain The school's subdomain from the URL.
 * @returns The school with its brand and its owner's name.
 * @throws {Error} Next's not-found signal when no school has the subdomain, or an unexpected-response error.
 */
export const getSiteSchool = cache(async (subdomain: string): Promise<SiteSchool> => {
  const { data, response } = await (await getApi()).GET("/schools/by-subdomain/{subdomain}", {
    params: { path: { subdomain } },
  });
  checkPublicResponse(response);
  // checkPublicResponse returned, so the API answered 2xx with the school.
  const { school, owner } = data!;
  return { ...toBrandedSchool(school), ownerName: owner.name };
});

/**
 * Lists the courses a school sells, newest first.
 *
 * @param subdomain The school's subdomain.
 * @returns The published courses without outlines.
 * @throws {Error} Next's not-found signal for an unknown school, or an unexpected-response error.
 */
export async function listSiteCourses(subdomain: string): Promise<Course[]> {
  const { data, response } = await (await getApi()).GET("/schools/by-subdomain/{subdomain}/courses", {
    params: { path: { subdomain } },
  });
  checkPublicResponse(response);
  // checkPublicResponse returned, so the API answered 2xx with the list.
  return data!.courses;
}

/**
 * Loads a published course with its curriculum, for its sales page.
 *
 * @param subdomain The school's subdomain.
 * @param slug The course's slug.
 * @returns The course.
 * @throws {Error} Next's not-found signal for an unknown school or a draft or missing course, or an unexpected-response error.
 */
export async function getSiteCourse(subdomain: string, slug: string): Promise<CourseWithOutline> {
  const { data, response } = await (await getApi()).GET("/schools/by-subdomain/{subdomain}/courses/{slug}", {
    params: { path: { subdomain, slug } },
  });
  checkPublicResponse(response);
  // checkPublicResponse returned, so the API answered 2xx with the course.
  return data!.course;
}
