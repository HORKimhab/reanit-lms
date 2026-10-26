import { createApiClient } from "@reanit/api-client";
import { domainHostnameSchema } from "@reanit/core/schools";

import { unexpectedResponse } from "../api";
import { getServerEnv } from "../env";

/** How long the answer for a host is reused, so the proxy asks the API about a custom domain at most once a minute. */
const CACHE_TTL_MS = 60_000;

/** Most hosts remembered; past it, the oldest is forgotten. */
const CACHE_MAX_HOSTS = 1000;

/**
 * Asks the API which school a verified custom domain serves.
 *
 * @param hostname A normalized hostname.
 * @returns The school's subdomain, or null when no school has verified the hostname.
 * @throws {Error} An unexpected-response error when the API fails.
 */
async function lookUpCustomDomain(hostname: string): Promise<string | null> {
  const { data, response } = await createApiClient(getServerEnv().API_URL).GET("/schools/by-domain/{hostname}", {
    params: { path: { hostname } },
  });
  if (response.status === 404) return null;
  if (!data) throw unexpectedResponse(response);
  return data.subdomain;
}

/**
 * Builds the proxy's custom domain lookup: hosts that can be custom domains are looked up through
 * the API, and each answer (school or none) is reused for `CACHE_TTL_MS`. Failed lookups are not kept.
 *
 * @param lookUp Finds the school a hostname serves; the API outside tests.
 * @param now Reads the current time in milliseconds.
 * @returns Resolves a request's host to the school's subdomain, or null.
 * @example
 * const resolve = createCustomDomainResolver();
 * await resolve("learn.angkor.com"); // "angkor"
 */
export function createCustomDomainResolver(lookUp = lookUpCustomDomain, now = Date.now) {
  const cache = new Map<string, { subdomain: string | null; expiresAt: number }>();

  /**
   * Resolves a host to the school whose verified custom domain it is.
   *
   * @param host The request's `Host` header.
   * @returns The school's subdomain, or null when the host cannot be a custom domain or no school verified it.
   * @throws {Error} When the lookup fails.
   */
  return async function resolveCustomDomain(host: string): Promise<string | null> {
    const parsed = domainHostnameSchema.safeParse(host);
    if (!parsed.success) return null;
    const hostname = parsed.data;
    const cached = cache.get(hostname);
    if (cached && cached.expiresAt > now()) return cached.subdomain;

    const subdomain = await lookUp(hostname);
    cache.delete(hostname);
    const oldest = cache.keys().next();
    if (cache.size >= CACHE_MAX_HOSTS && !oldest.done) cache.delete(oldest.value);
    cache.set(hostname, { subdomain, expiresAt: now() + CACHE_TTL_MS });
    return subdomain;
  };
}
