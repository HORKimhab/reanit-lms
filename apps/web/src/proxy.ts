import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { getRootDomain } from "./server/env";
import { schoolSubdomainFromHost, toSchoolPath } from "./server/schools/host";

// Redirects and rewrites requests to the right locale.
const handleI18nRouting = createMiddleware(routing);

/** Headers Next uses to tell a pass-through from a rewrite; replaced when re-targeting. */
const ROUTING_HEADERS = ["x-middleware-next", "x-middleware-rewrite"];

/**
 * Resolves the locale, then serves a school's subdomain from its `/s/<subdomain>` routes.
 * Locale redirects pass through untouched, since their visible URLs never include `/s/...`.
 *
 * @param request The incoming request.
 * @returns next-intl's response, re-targeted to the school's routes on a school subdomain.
 * @throws {z.ZodError} When `ROOT_DOMAIN` is malformed.
 */
export default function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  const rootDomain = getRootDomain();
  const subdomain = rootDomain ? schoolSubdomainFromHost(request.headers.get("host"), rootDomain) : null;
  if (!subdomain || response.headers.has("location")) return response;

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
