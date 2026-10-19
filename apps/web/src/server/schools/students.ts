import { studentSearchSchema, type StudentPage, type StudentSearchInput } from "@reanit/core/schools";

import { getApi } from "../api";
import { checkStaffResponse } from "./staff";

/** The first page of everyone, for a students URL whose query makes no sense. */
const FIRST_PAGE: StudentSearchInput = { page: 1 };

/**
 * Reads the students list's search and page from its URL query.
 *
 * @param query The page's search params.
 * @returns The parsed search, or the first page of everyone when the query is malformed.
 */
export function studentSearchFrom(query: Record<string, string | string[] | undefined>): StudentSearchInput {
  const parsed = studentSearchSchema.safeParse(query);
  return parsed.success ? parsed.data : FIRST_PAGE;
}

/**
 * Loads one page of the signed-in creator's school's students.
 *
 * @param query The search and page.
 * @param query.q Text to find in a student's name or email.
 * @param query.page 1-based page.
 * @returns The page's students, newest first, and how many match.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function listStudents({ q, page }: StudentSearchInput): Promise<StudentPage> {
  const { data, response } = await (await getApi()).GET("/students", { params: { query: { ...(q && { q }), page } } });
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the page.
  const result = data!;
  return { ...result, students: result.students.map((student) => ({ ...student, joinedAt: new Date(student.joinedAt) })) };
}
