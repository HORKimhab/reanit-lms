import { notFound, redirect } from "next/navigation";

import { ONBOARDING_PATH } from "@/app/[locale]/(auth)/onboarding/constants";

import { unexpectedResponse } from "../api";
import { loginPath } from "../auth/session";

/** Where creator pages send signed-out visitors back to after logging in. */
const DASHBOARD_PATH = "/dashboard";

/**
 * Turns an API answer to a creator's request into the page's next step: signed-out visitors log
 * in, users who run no school go to onboarding, and a missing course is a 404.
 *
 * @param response The API's response to a staff route.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export function checkStaffResponse(response: Response) {
  if (response.ok) return;
  if (response.status === 401) redirect(loginPath(DASHBOARD_PATH));
  if (response.status === 403) redirect(ONBOARDING_PATH);
  if (response.status === 404) notFound();
  throw unexpectedResponse(response);
}
