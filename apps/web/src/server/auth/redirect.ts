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

/**
 * Reads `next` from a page's search params for the auth forms.
 *
 * @param value Raw search param; repeated params arrive as an array.
 * @returns A safe local path, or undefined when absent or not a single value.
 */
export function nextFromQuery(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? safeRedirectPath(value) : undefined;
}
