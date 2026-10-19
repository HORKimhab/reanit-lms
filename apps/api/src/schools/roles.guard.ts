import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { MembershipRole, SchoolService } from "@reanit/core/schools";
import { ClsService } from "nestjs-cls";

import type { RequestContext } from "../context/request-context";
import { SCHOOL_SERVICE } from "./schools.tokens";

/** Metadata key holding the roles a route accepts. */
export const ROLES = "schools:roles";

/**
 * Resolves the signed-in creator's school into the request context and checks their role in it.
 * Applied with `@Roles(...)`, after the global `SessionGuard` has resolved the user.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  /**
   * Receives what it needs to resolve the staff school.
   *
   * @param reflector Reads `@Roles()`.
   * @param schools Finds the school the user runs.
   * @param cls The request context the school is stored in.
   */
  constructor(
    private readonly reflector: Reflector,
    @Inject(SCHOOL_SERVICE) private readonly schools: SchoolService,
    private readonly cls: ClsService<RequestContext>,
  ) {}

  /**
   * Finds the user's staff school and checks their role against the route's.
   *
   * @param context The request being handled.
   * @returns True when the user may proceed.
   * @throws {NotSchoolStaffError} When the user runs no school (403).
   * @throws {ForbiddenException} When the user's role is not one the route accepts.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<MembershipRole[]>(ROLES, [context.getHandler(), context.getClass()]);
    // SessionGuard runs first and rejects signed-out callers, so a @Roles route always has a user.
    const user = this.cls.get("user")!;
    const { school, role } = await this.schools.getStaffSchool(user.id);
    if (!roles.includes(role)) throw new ForbiddenException("Your role in this school cannot do this.");
    this.cls.set("school", { ...school, role });
    return true;
  }
}
