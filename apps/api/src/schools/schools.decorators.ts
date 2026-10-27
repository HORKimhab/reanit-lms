import { applyDecorators, createParamDecorator, SetMetadata, UseGuards } from "@nestjs/common";
import type { MembershipRole } from "@reanit/core/schools";
import { ClsServiceManager } from "nestjs-cls";

import type { RequestContext } from "../context/request-context";
import { ROLES, RolesGuard } from "./roles.guard";

/**
 * Limits a route to staff of the caller's school with one of the given roles, and puts that
 * school in the request context for `@CurrentSchool()` and the tenant client.
 *
 * @param roles Roles that may use the route.
 * @returns The decorator.
 */
export function Roles(...roles: MembershipRole[]) {
  return applyDecorators(SetMetadata(ROLES, roles), UseGuards(RolesGuard));
}

/**
 * Reads the school `RolesGuard` put in the request context.
 *
 * @returns The school with the caller's role in it.
 */
function readCurrentSchool(): RequestContext["school"] {
  return ClsServiceManager.getClsService<RequestContext>().get("school");
}

/** Injects the caller's school into a handler parameter on a `@Roles(...)` route. */
export const CurrentSchool = createParamDecorator(readCurrentSchool);

/** The school `@CurrentSchool()` injects on a `@Roles(...)` route, where it is always set. */
export type StaffSchool = NonNullable<RequestContext["school"]>;
