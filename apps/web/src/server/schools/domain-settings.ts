import type { CustomDomain } from "@reanit/core/schools";

import { getApi } from "../api";
import { checkStaffResponse } from "./staff";

/** The settings page's custom domain section: whether domains are offered, and the school's domain. */
export type CustomDomainSettings = { isAvailable: boolean; domain: CustomDomain | null };

/**
 * Loads the staff member's school's custom domain; the API checks a certificate that is being issued on the way.
 *
 * @returns Whether custom domains are offered, and the domain (null when the school has none).
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function getCustomDomainSettings(): Promise<CustomDomainSettings> {
  const { data, response } = await (await getApi()).GET("/schools/current/domain");
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the settings.
  return data!;
}
