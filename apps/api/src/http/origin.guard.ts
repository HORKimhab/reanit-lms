import { ForbiddenException, Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { ENV } from "@reanit/nest";

import type { Env } from "../config/env";

/** Methods that read only; everything else must come from the web app's own origin. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Tells whether a browser origin is the web app or one of its school subdomains.
 *
 * @param origin The request's `Origin` header.
 * @param appUrl Public origin of the web app.
 * @returns True when the origin may send mutating requests.
 */
export function isTrustedOrigin(origin: string, appUrl: string): boolean {
  const app = new URL(appUrl);
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return url.protocol === app.protocol && (url.host === app.host || url.host.endsWith(`.${app.host}`));
}

/**
 * CSRF protection, together with the SameSite=Lax session cookie: a browser sends `Origin` on
 * every cross-site POST, so a mutating request whose origin is not the web app is refused.
 * Requests without `Origin` (server-side calls, non-browser clients) carry no ambient cookie risk.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  /**
   * Receives the environment with the trusted origin.
   *
   * @param env Validated environment.
   */
  constructor(@Inject(ENV) private readonly env: Env) {}

  /**
   * Checks the origin of a mutating request.
   *
   * @param context The request being handled.
   * @returns True when the request may proceed.
   * @throws {ForbiddenException} When a mutating request comes from another site.
   */
  canActivate(context: ExecutionContext): boolean {
    const { method, headers } = context.switchToHttp().getRequest<FastifyRequest>();
    if (SAFE_METHODS.has(method) || !headers.origin || isTrustedOrigin(headers.origin, this.env.APP_URL)) return true;
    throw new ForbiddenException("Cross-site request refused.");
  }
}
