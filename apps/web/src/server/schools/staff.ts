import type { AuthUser } from "@reanit/core/auth";
import { NotSchoolStaffError, type MembershipRole, type School } from "@reanit/core/schools";
import { redirect } from "next/navigation";

import { ONBOARDING_PATH } from "@/app/[locale]/(auth)/onboarding/constants";

import { requireUser } from "../auth/session";
import { getSchoolService } from "./service";

/** Where creator pages send signed-out visitors back to after logging in. */
const DASHBOARD_PATH = "/dashboard";

/**
 * Resolves the signed-in creator and the school their dashboard works on.
 *
 * @returns The user, their school and their role in it.
 * @throws {Error} Next's redirect signal: to log in when signed out, to onboarding when they run no school.
 */
export async function requireStaffSchool(): Promise<{ user: AuthUser; school: School; role: MembershipRole }> {
  const user = await requireUser(DASHBOARD_PATH);
  try {
    return { user, ...(await getSchoolService().getStaffSchool(user.id)) };
  } catch (error) {
    if (error instanceof NotSchoolStaffError) redirect(ONBOARDING_PATH);
    throw error;
  }
}
