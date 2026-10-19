import { safeRedirectPath, SESSION_COOKIE, type AuthUser } from "@reanit/core/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getApi, unexpectedResponse } from "../api";
import { parseSetCookie } from "./set-cookie";

/**
 * Passes the session cookie an API response set (sign-up, login) on to the browser.
 * Server actions call the API server-to-server, so the browser never sees that response.
 *
 * @param response The API's response.
 */
export async function relaySessionCookie(response: Response) {
  const jar = await cookies();
  for (const header of response.headers.getSetCookie()) {
    const cookie = parseSetCookie(header);
    if (cookie?.name === SESSION_COOKIE) jar.set(cookie.name, cookie.value, cookie.options);
  }
}

/**
 * Reads the signed-in user from the session cookie.
 *
 * @returns The user, or null when signed out or the session expired.
 * @throws {Error} When the API fails.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!(await cookies()).get(SESSION_COOKIE)) return null;
  const { data, response } = await (await getApi()).GET("/auth/me");
  if (response.status === 401) return null;
  if (!data) throw unexpectedResponse(response);
  return data.user;
}

/**
 * Ends the current session, if any, and clears its cookie.
 *
 * @throws {Error} When the API fails.
 */
export async function endSession() {
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)) {
    const { response } = await (await getApi()).POST("/auth/logout");
    if (!response.ok) throw unexpectedResponse(response);
  }
  jar.delete(SESSION_COOKIE);
}

/**
 * Sends a signed-in visitor on from the log-in and sign-up pages.
 *
 * @param next Untrusted `next` from the query string.
 * @throws {Error} Next's redirect signal when someone is signed in.
 */
export async function redirectIfSignedIn(next: unknown) {
  if (await getCurrentUser()) redirect(safeRedirectPath(next));
}

/**
 * Returns the signed-in user, or sends the visitor to log in and come back to `next`.
 *
 * @param next Path to return to after logging in.
 * @returns The signed-in user.
 * @throws {Error} Next's redirect signal when signed out.
 */
export async function requireUser(next: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(next));
  return user;
}

/**
 * Builds the login URL that comes back to a page afterwards.
 *
 * @param next Path to return to.
 * @returns The login path.
 */
export function loginPath(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
