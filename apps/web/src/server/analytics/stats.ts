import type { CourseStats } from "@reanit/core/analytics";

import { getApi } from "../api";
import { checkStaffResponse } from "../schools/staff";

/**
 * Lists the signed-in creator's school's courses with their students, completions and revenue.
 *
 * @returns The courses, best sellers first.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function listCourseStats(): Promise<CourseStats[]> {
  const { data, response } = await (await getApi()).GET("/stats/courses");
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the stats.
  return data!.courses;
}
