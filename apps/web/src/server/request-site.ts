import { headers } from "next/headers";

/** Hosts served over plain HTTP in development. */
const LOCAL_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Reads where the current request was sent: its host, and the origin to build absolute links
 * from (canonical URLs, share images). Behind a proxy, `X-Forwarded-Proto` gives the scheme.
 *
 * @returns The host and origin, e.g. `angkor.reanit.com` and `https://angkor.reanit.com`.
 */
export async function getRequestSite(): Promise<{ host: string; origin: string }> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost";
  const proto = incoming.get("x-forwarded-proto") ?? (LOCAL_HOST.test(host) ? "http" : "https");
  return { host, origin: `${proto}://${host}` };
}
