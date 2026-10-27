import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { ADMIN_PATHS } from "@/server/admin/console";

/**
 * The console's front door: opens the schools list.
 *
 * @returns Nothing; it redirects.
 */
export default async function AdminHome() {
  redirect({ href: ADMIN_PATHS.schools, locale: await getLocale() });
}
