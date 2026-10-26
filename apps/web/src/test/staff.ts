// The creator's school and students as the API returns them, for dashboard tests.
import type { MembershipRole, School, StudentSummary } from "@reanit/core/schools";

import { onApi } from "./api";
import { signIn } from "./session";

/** A school whose owner picked a brand color but uploaded no logo. */
export const STAFF_SCHOOL: School = {
  id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a10",
  name: "Angkor Academy",
  subdomain: "angkor",
  brandColor: "#0055aa",
  logoUrl: null,
};

/** Students as `GET /students` lists them, newest first: one without a name. */
export const STUDENTS: StudentSummary[] = [
  {
    id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a31",
    name: null,
    email: "dara.pich@example.com",
    joinedAt: new Date("2026-09-21T03:00:00Z"),
    courses: 1,
    completedCourses: 0,
  },
  {
    id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a30",
    name: "Sokha Chan",
    email: "sokha@example.com",
    joinedAt: new Date("2026-03-14T09:30:00Z"),
    courses: 2,
    completedCourses: 1,
  },
];

/**
 * Signs a staff member of `STAFF_SCHOOL` in, with the given role, as dashboard pages see them.
 *
 * @param role Their role in the school.
 */
export function signInAsStaff(role: MembershipRole) {
  signIn();
  onApi("GET /schools/current", Response.json({ school: STAFF_SCHOOL, role }));
}
