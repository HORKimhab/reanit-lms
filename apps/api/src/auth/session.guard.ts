import { Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SESSION_COOKIE, type AuthService } from "@reanit/core/auth";
import type { FastifyRequest } from "fastify";
import { ClsService } from "nestjs-cls";

import type { RequestContext } from "../context/request-context";
import { IS_PUBLIC } from "./auth.decorators";
import { AUTH_SERVICE } from "./auth.tokens";

/** Global guard: every route needs a valid session cookie unless it is marked `@Public()`. */
@Injectable()
export class SessionGuard implements CanActivate {
  /**
   * Receives what it needs to resolve sessions.
   *
   * @param reflector Reads `@Public()`.
   * @param auth Resolves a session token to its user.
   * @param cls The request context the user is stored in.
   */
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_SERVICE) private readonly auth: AuthService,
    private readonly cls: ClsService<RequestContext>,
  ) {}

  /**
   * Resolves the session cookie and stores the user in the request context.
   *
   * @param context The request being handled.
   * @returns True when the request may proceed.
   * @throws {UnauthorizedException} When a non-public route has no valid session.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const token = context.switchToHttp().getRequest<FastifyRequest>().cookies[SESSION_COOKIE];
    const user = token ? await this.auth.getSessionUser(token) : null;
    if (user) {
      this.cls.set("user", user);
      return true;
    }
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    throw new UnauthorizedException("Sign in to continue.");
  }
}
