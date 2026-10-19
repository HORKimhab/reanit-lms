"use server";

import { createSchoolSchema, SubdomainTakenError } from "@reanit/core/schools";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/session";
import { invalidFieldsOf } from "@/server/form-errors";
import { getSchoolService } from "@/server/schools/service";

/** Result of the last submit, shown by the onboarding wizard (WEB-11). */
export type CreateSchoolState = {
  status: "idle" | "invalid" | "subdomainTaken";
  /** Form fields to mark invalid. */
  invalidFields: string[];
};

/** Where the wizard lives, so a signed-out creator comes back to it after logging in. */
const ONBOARDING_PATH = "/onboarding";
const DASHBOARD_PATH = "/dashboard";

/**
 * Opens a school owned by the signed-in creator, then goes to the dashboard.
 *
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `name` and `subdomain`.
 * @returns An error state; on success it redirects instead.
 * @throws {Error} Next's redirect signal (to log in, or to the dashboard on success), or any unexpected failure.
 */
export async function createSchool(_previous: CreateSchoolState, formData: FormData): Promise<CreateSchoolState> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(ONBOARDING_PATH)}`);

  const parsed = createSchoolSchema.safeParse({ name: formData.get("name"), subdomain: formData.get("subdomain") });
  if (!parsed.success) return { status: "invalid", invalidFields: invalidFieldsOf(parsed.error) };
  try {
    await getSchoolService().createSchool(parsed.data, user.id);
  } catch (error) {
    if (error instanceof SubdomainTakenError) return { status: "subdomainTaken", invalidFields: ["subdomain"] };
    throw error;
  }
  redirect(DASHBOARD_PATH);
}
