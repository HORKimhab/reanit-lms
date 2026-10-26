import { SetMetadata } from "@nestjs/common";
import type { AuditAction } from "@reanit/core/audit";

/** Metadata key holding a route's audit action and target. */
export const AUDITED = "audit:action";

/** What a route call is about: its path params, its response body and the caller's school. */
export type AuditCall = { params: Record<string, string>; response: unknown; schoolId: string };

/** Finds the id of what a route call acted on. */
export type AuditTarget = (call: AuditCall) => string;

/** Finds the school a call happened in from its response, for a route outside the caller's staff school. */
export type AuditSchool = (response: unknown) => string;

/** A route's audit action, how to find its target, and for a route outside a staff school, its school. */
export type AuditedRoute = { action: AuditAction; target: AuditTarget; schoolOf?: AuditSchool };

/**
 * Records every successful call of a staff route in the school's audit log, with the caller and the request id.
 *
 * @param action What the route does.
 * @param target Finds the id of what it acted on.
 * @param schoolOf Finds the school from the response, for a route that is not a `@Roles` route (such as
 * accepting an invite, where the caller is not staff yet); `@Roles` routes log to the caller's school.
 * @returns The decorator.
 * @example
 * applyDecorators(Patch(":id"), Audited("course.update", pathParam("id")));
 */
export function Audited(action: AuditAction, target: AuditTarget, schoolOf?: AuditSchool) {
  return SetMetadata(AUDITED, { action, target, schoolOf } satisfies AuditedRoute);
}

/**
 * Targets the id in a path param, e.g. the `:id` of `PATCH /courses/:id`.
 *
 * @param name The param's name.
 * @returns The target finder.
 */
export function pathParam(name: string): AuditTarget {
  return ({ params }) => params[name] ?? "";
}

/**
 * Targets the caller's school, for routes that change the school itself.
 *
 * @param call The route call.
 * @param call.schoolId The caller's school.
 * @returns The school's id.
 */
export function currentSchool({ schoolId }: AuditCall): string {
  return schoolId;
}
