import { subdomainSchema } from "@reanit/core/schools";

/** Pages that live on the platform, not under a school, even on a school's subdomain. */
const PLATFORM_PATHS = ["/login", "/signup"];

/**
 * Picks the school subdomain out of a request's host.
 *
 * @param host The `Host` header, e.g. `angkor.reanit.com`.
 * @param rootDomain The platform's root domain, e.g. `reanit.com`.
 * @returns The subdomain, or null for the root domain, other hosts, nested or reserved subdomains.
 */
export function schoolSubdomainFromHost(host: string | null, rootDomain: string): string | null {
  const suffix = `.${rootDomain}`;
  const normalized = host?.toLowerCase();
  if (!normalized?.endsWith(suffix)) return null;
  const parsed = subdomainSchema.safeParse(normalized.slice(0, -suffix.length));
  return parsed.success ? parsed.data : null;
}

/**
 * Maps a locale-prefixed internal path onto a school's routes: `/en/courses` → `/en/s/angkor/courses`.
 * Paths already under that school stay as they are, so `/s/angkor/...` links keep working on the subdomain.
 *
 * @param pathname Internal path, starting with the locale.
 * @param subdomain The school's subdomain.
 * @returns The school path, or null for platform pages that should not be rewritten.
 */
export function toSchoolPath(pathname: string, subdomain: string): string | null {
  const [, locale, ...rest] = pathname.split("/");
  const path = `/${rest.join("/")}`;
  if (PLATFORM_PATHS.some((platformPath) => path === platformPath || path.startsWith(`${platformPath}/`))) return null;
  const schoolBase = `/s/${subdomain}`;
  if (path === schoolBase || path.startsWith(`${schoolBase}/`)) return pathname;
  return `/${locale}${schoolBase}${path === "/" ? "" : path}`;
}
