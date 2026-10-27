import { ForbiddenException, Inject, Injectable, type CanActivate } from "@nestjs/common";
import { ENV } from "@reanit/nest";
import { ClsService } from "nestjs-cls";

import type { Env } from "../config/env";
import type { RequestContext } from "../context/request-context";

/**
 * Lets only the platform's admins through, the people whose emails are in `PLATFORM_ADMIN_EMAILS`.
 * Applied with `@UseGuards(PlatformAdminGuard)`, after the global `SessionGuard` has resolved the user.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  /**
   * Receives the request context and the environment.
   *
   * @param cls The request context the signed-in user is in.
   * @param env Validated environment, with the admins' emails.
   */
  constructor(
    private readonly cls: ClsService<RequestContext>,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Checks the signed-in user is one of the platform's admins.
   *
   * @returns True when they are.
   * @throws {ForbiddenException} When they are not.
   */
  canActivate(): boolean {
    // SessionGuard runs first and rejects signed-out callers, so the route always has a user.
    const user = this.cls.get("user")!;
    if (!this.env.PLATFORM_ADMIN_EMAILS.includes(user.email)) throw new ForbiddenException("Only the platform's admins can do this.");
    return true;
  }
}
