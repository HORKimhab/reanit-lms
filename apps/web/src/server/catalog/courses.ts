import type { Course, CourseWithOutline } from "@reanit/core/catalog";

import { getApi } from "../api";
import { checkStaffResponse } from "../schools/staff";

/**
 * Lists the signed-in creator's school's courses, newest first, drafts included.
 *
 * @returns The courses without outlines.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function listStaffCourses(): Promise<Course[]> {
  const { data, response } = await (await getApi()).GET("/courses");
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the list.
  return data!.courses;
}

/**
 * Loads one of the creator's courses with its outline, for the builder.
 *
 * @param slug The course's slug from the URL.
 * @returns The course.
 * @throws {Error} Next's not-found signal for an unknown course, a redirect signal, or an unexpected-response error.
 */
export async function getStaffCourse(slug: string): Promise<CourseWithOutline> {
  const { data, response } = await (await getApi()).GET("/courses/by-slug/{slug}", { params: { path: { slug } } });
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the course.
  return data!.course;
}
