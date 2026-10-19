// Signs a test user in. Needs next/headers and @/server/auth/service mocked with the doubles in this folder.
import { SESSION_COOKIE } from "@/server/auth/session";

import { authService, SESSION } from "./auth-service";
import { cookieJar } from "./headers";

/** Puts `SESSION`'s cookie in the jar and makes the auth service resolve it to `SESSION.user`. */
export function signIn() {
  cookieJar.set(SESSION_COOKIE, SESSION.token);
  authService.getSessionUser.mockResolvedValue(SESSION.user);
}
