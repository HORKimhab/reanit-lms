import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { getRootDomain } from "./server/env";
import { createCustomDomainResolver } from "./server/schools/custom-domain";
import { schoolSubdomainFromHost, toSchoolPath } from "./server/schools/host";

// Redirects and rewrites requests to the right locale.
const handleI18nRouting = createMiddleware(routing);

/** Headers Next uses to tell a pass-through from a rewrite; replaced when re-targeting. */
const ROUTING_HEADERS = ["x-middleware-next", "x-middleware-rewrite"];

// Finds the school a custom domain serves, remembering answers for a minute.
const resolveCustomDomain = createCustomDomainResolver();

/**
 * Finds the school a request's host serves: a subdomain of the root domain, or a school's verified custom domain.
 *
 * @param host The `Host` header.
 * @param rootDomain The platform's root domain.
 * @returns The school's subdomain, or null for the platform's own hosts and unknown domains.
 * @throws {Error} When the custom domain lookup fails.
 */
async function schoolForHost(host: string | null, rootDomain: string): Promise<string | null> {
  if (!host) return null;
  const subdomain = schoolSubdomainFromHost(host, rootDomain);
  const isPlatformHost = host === rootDomain || host.endsWith(`.${rootDomain}`);
  return subdomain ?? (isPlatformHost ? null : resolveCustomDomain(host));
}

/**
 * Resolves the locale, then serves a school's subdomain or verified custom domain from its
 * `/s/<subdomain>` routes. Locale redirects pass through untouched, since their visible URLs never include `/s/...`.
 *
 * @param request The incoming request.
 * @returns next-intl's response, re-targeted to the school's routes on a school's host.
 * @throws {z.ZodError} When `ROOT_DOMAIN` is malformed.
 * @throws {Error} When the custom domain lookup fails.
 */
export default async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  const rootDomain = getRootDomain();
  if (!rootDomain || response.headers.has("location")) return response;
  const subdomain = await schoolForHost(request.headers.get("host")?.toLowerCase() ?? null, rootDomain);
  if (!subdomain) return response;

  const target = new URL(response.headers.get("x-middleware-rewrite") ?? request.url);
  const schoolPath = toSchoolPath(target.pathname, subdomain);
  if (!schoolPath) return response;
  target.pathname = schoolPath;

  const headers = new Headers(response.headers);
  ROUTING_HEADERS.forEach((name) => headers.delete(name));
  return NextResponse.rewrite(target, { headers });
}

export const config = {
  // Skip API routes, Next internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
