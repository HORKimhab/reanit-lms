import { notFound, redirect } from "next/navigation";

import { unexpectedResponse } from "../api";
import { loginPath } from "../auth/session";

/**
 * Turns an API answer to a student's request into the page's next step: signed-out visitors log
 * in and come back, and what the student cannot see (another's order, a course they do not have,
 * a malformed id) is a 404.
 *
 * @param response The API's response to a student route.
 * @param returnPath Path to come back to after logging in.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export function checkStudentResponse(response: Response, returnPath: string) {
  if (response.ok) return;
  if (response.status === 401) redirect(loginPath(returnPath));
  if (response.status === 400 || response.status === 403 || response.status === 404) notFound();
  throw unexpectedResponse(response);
}
