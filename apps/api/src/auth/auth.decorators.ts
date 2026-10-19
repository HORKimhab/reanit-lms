import { createParamDecorator, SetMetadata } from "@nestjs/common";
import type { AuthUser } from "@reanit/core/auth";
import { ClsServiceManager } from "nestjs-cls";

import type { RequestContext } from "../context/request-context";

/** Metadata key `SessionGuard` reads to let signed-out callers through. */
export const IS_PUBLIC = "auth:isPublic";

/**
 * Opens a route or controller to signed-out callers. The signed-in user, if any, is still resolved.
 *
 * @returns The decorator.
 */
export function Public() {
  return SetMetadata(IS_PUBLIC, true);
}

/**
 * Reads the signed-in user that `SessionGuard` put in the request context.
 *
 * @returns The user; undefined only on a `@Public()` route with no session.
 */
function readCurrentUser(): AuthUser | undefined {
  return ClsServiceManager.getClsService<RequestContext>().get("user");
}

/** Injects the signed-in user into a handler parameter: `me(@CurrentUser() user: AuthUser)`. */
export const CurrentUser = createParamDecorator(readCurrentUser);
