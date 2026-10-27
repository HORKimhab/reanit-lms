// Signs a fake user in for route tests: the fake auth service resolves any session cookie to them.
import { SESSION_COOKIE, type AuthUser } from "@reanit/core/auth";
import type { MembershipRole, School } from "@reanit/core/schools";

import { PLATFORM_ADMIN_EMAIL, useTestApp, type FakeClients, type TestApp } from "./app";

/** The user test requests are signed in as. */
export const TEST_USER: AuthUser = { id: "0b9a6d1e-5c3f-4a2b-9e8d-7c6b5a4f3e2d", email: "dara@example.com", name: "Dara" };

/** The test user, signed in with an email in `PLATFORM_ADMIN_EMAILS`. */
export const PLATFORM_ADMIN_USER: AuthUser = { ...TEST_USER, email: PLATFORM_ADMIN_EMAIL };

/** A school test users run. */
export const TEST_SCHOOL: School = {
  id: "6f5e4d3c-2b1a-4098-8f7e-6d5c4b3a2918",
  name: "Angkor Academy",
  subdomain: "angkor",
  brandColor: null,
  logoUrl: null,
  paymentQrUrl: null,
};

/**
 * Makes the fake auth service accept a session for the user.
 *
 * @param clients Fakes from `createFakeClients`.
 * @param user Who the session belongs to.
 * @returns Headers that carry the session cookie.
 */
export function signInAs(clients: FakeClients, user: AuthUser = TEST_USER): { cookie: string } {
  clients.auth.getSessionUser.mockResolvedValue(user);
  return { cookie: `${SESSION_COOKIE}=test-session` };
}

/**
 * Gives the signed-in staff member a role in `TEST_SCHOOL`, as the roles guard will find it.
 *
 * @param clients Fakes from `createFakeClients`.
 * @param role Their role.
 */
export function setStaffRole(clients: FakeClients, role: MembershipRole) {
  clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role });
}

/** A booted app with an instructor of `TEST_SCHOOL` signed in. */
type StaffApp = TestApp & { headers: { cookie: string } };

/**
 * Prepares fakes for an instructor of `TEST_SCHOOL` who is signed in.
 *
 * @param clients Fakes from `createFakeClients`.
 */
function signInStaff(clients: FakeClients) {
  signInAs(clients);
  setStaffRole(clients, "instructor");
}

/**
 * Boots a fresh app before each test with an instructor of `TEST_SCHOOL` signed in, and closes it after.
 *
 * @returns An object whose fields are replaced before each test: read them inside tests, never destructure at file level.
 */
export function useStaffApp(): StaffApp {
  return Object.assign(useTestApp(signInStaff), { headers: { cookie: `${SESSION_COOKIE}=test-session` } });
}
