// Signs a fake user in for route tests: the fake auth service resolves any session cookie to them.
import { SESSION_COOKIE, type AuthUser } from "@reanit/core/auth";
import type { School } from "@reanit/core/schools";

import type { FakeClients } from "./app";

/** The user test requests are signed in as. */
export const TEST_USER: AuthUser = { id: "0b9a6d1e-5c3f-4a2b-9e8d-7c6b5a4f3e2d", email: "dara@example.com", name: "Dara" };

/** A school test users run. */
export const TEST_SCHOOL: School = { id: "6f5e4d3c-2b1a-4098-8f7e-6d5c4b3a2918", name: "Angkor Academy", subdomain: "angkor" };

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
