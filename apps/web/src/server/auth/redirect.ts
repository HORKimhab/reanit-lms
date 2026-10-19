const HOME = "/";

/**
 * Keeps post-login redirects on this site. Anything that is not a same-origin
 * path (absolute URLs, `//host`, `/\host`) falls back to home, blocking open redirects.
 *
 * @param next Untrusted `next` value from a form or query string.
 * @returns A safe local path.
 */
export function safeRedirectPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return HOME;
  }
  return next;
}
