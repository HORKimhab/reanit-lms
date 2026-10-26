import type { NotificationPreferences } from "@reanit/core/notifications";

import { getApi } from "../api";
import { checkStaffResponse } from "../schools/staff";

/**
 * Loads the signed-in staff member's email settings for their school.
 *
 * @returns Their settings; every email, in English, until they save any.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data, response } = await (await getApi()).GET("/notifications/preferences");
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the settings.
  return data!.preferences;
}
