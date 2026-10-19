import { SetMetadata } from "@nestjs/common";
import type { AuditAction } from "@reanit/core/audit";

/** Metadata key holding a route's audit action and target. */
export const AUDITED = "audit:action";

/** What a route call is about: its path params, its response body and the caller's school. */
export type AuditCall = { params: Record<string, string>; response: unknown; schoolId: string };

/** Finds the id of what a route call acted on. */
export type AuditTarget = (call: AuditCall) => string;

/** A route's audit action and how to find its target. */
export type AuditedRoute = { action: AuditAction; target: AuditTarget };

/**
 * Records every successful call of a staff route in the school's audit log, with the caller and the request id.
 *
 * @param action What the route does.
 * @param target Finds the id of what it acted on.
 * @returns The decorator.
 * @example
 * applyDecorators(Patch(":id"), Audited("course.update", pathParam("id")));
 */
export function Audited(action: AuditAction, target: AuditTarget) {
  return SetMetadata(AUDITED, { action, target } satisfies AuditedRoute);
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
