import type { PlayerCourse } from "@reanit/core/learning";
import { cache } from "react";

import { getApi } from "../api";
import { checkStudentResponse } from "../schools/student";

/**
 * Loads a course for its enrolled student. Cached per request, so the player layout and the lesson share one call.
 *
 * @param subdomain The school's subdomain.
 * @param slug The course's slug.
 * @returns The course with its outline and the student's progress.
 * @throws {Error} Next's redirect signal when signed out, its not-found signal when the student does not have the course, or an unexpected-response error.
 */
export const getPlayerCourse = cache(async (subdomain: string, slug: string): Promise<PlayerCourse> => {
  const { data, response } = await (await getApi()).GET("/schools/by-subdomain/{subdomain}/learn/{slug}", {
    params: { path: { subdomain, slug } },
  });
  checkStudentResponse(response, `/s/${subdomain}/learn/${slug}`);
  // checkStudentResponse returned, so the API answered 2xx with the course.
  return data!.course;
});

/**
 * Signs a URL to a lesson's video or PDF for its enrolled student.
 *
 * @param subdomain The school's subdomain.
 * @param lessonId The lesson.
 * @param returnPath The lesson's player path, to come back to after logging in.
 * @returns The URL, or null when no file is attached yet.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function getLessonFileUrl(subdomain: string, lessonId: string, returnPath: string): Promise<string | null> {
  const { data, response } = await (await getApi()).GET("/schools/by-subdomain/{subdomain}/lessons/{lessonId}/media", {
    params: { path: { subdomain, lessonId } },
  });
  if (response.status === 404) return null;
  checkStudentResponse(response, returnPath);
  // checkStudentResponse returned, so the API answered 2xx with the URL.
  return data!.url;
}
