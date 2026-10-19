import type { CookieSerializeOptions } from "@fastify/cookie";

/** Cookie that holds the raw session token. Only its hash is stored. */
export const SESSION_COOKIE = "reanit_session";

/**
 * Cookie settings for the session: unreadable by scripts, sent on top-level navigation
 * but not on cross-site POSTs (SameSite=Lax), and Secure whenever the app is served over HTTPS.
 *
 * @param appUrl Public origin of the web app.
 * @param expiresAt When the session ends; omit when clearing the cookie.
 * @returns Options for `reply.setCookie` / `reply.clearCookie`.
 */
export function sessionCookieOptions(appUrl: string, expiresAt?: Date): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: new URL(appUrl).protocol === "https:",
    sameSite: "lax",
    path: "/",
    ...(expiresAt && { expires: expiresAt }),
  };
}
