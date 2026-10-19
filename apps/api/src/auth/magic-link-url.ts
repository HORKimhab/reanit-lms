import { MAGIC_LINK_TTL_MS } from "@reanit/core/auth";

/** Path on the web origin that reaches `GET /auth/magic-link/verify` through its `/api` rewrite (NEST-08). */
const MAGIC_LINK_VERIFY_PATH = "/api/auth/magic-link/verify";

const MINUTE_MS = 60 * 1000;

/** How long a magic link works, in whole minutes, as its email says. */
export const MAGIC_LINK_MINUTES = MAGIC_LINK_TTL_MS / MINUTE_MS;

/**
 * Builds the link a magic-link email carries: the verify route on the web origin, with the token and where to land.
 *
 * @param link Where the link points.
 * @param link.appUrl Public origin of the web app.
 * @param link.token Raw one-time token.
 * @param link.next Safe local path to land on after signing in.
 * @returns The absolute URL.
 */
export function magicLinkUrl({ appUrl, token, next }: { appUrl: string; token: string; next: string }): string {
  const url = new URL(MAGIC_LINK_VERIFY_PATH, appUrl);
  url.search = new URLSearchParams({ token, next }).toString();
  return url.href;
}
