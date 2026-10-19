import type { AuthSession, AuthUser } from "@reanit/core/auth";
import { cookies } from "next/headers";

import { getAuthService } from "./service";

/** Cookie that holds the raw session token. */
export const SESSION_COOKIE = "reanit_session";

/**
 * Stores a new session in an HTTP-only cookie that expires with it.
 *
 * @param session Session returned by sign-up, login or magic link.
 */
export async function setSessionCookie(session: AuthSession) {
  (await cookies()).set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
}

/**
 * Reads the signed-in user from the session cookie.
 *
 * @returns The user, or null when signed out or the session expired.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? getAuthService().getSessionUser(token) : null;
}

/** Ends the current session, if any, and clears its cookie. */
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getAuthService().logOut(token);
  jar.delete(SESSION_COOKIE);
}
