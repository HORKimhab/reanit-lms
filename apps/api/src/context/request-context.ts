import { Module } from "@nestjs/common";
import type { AuthUser } from "@reanit/core/auth";
import type { MembershipRole } from "@reanit/core/schools";
import { ClsModule, type ClsStore } from "nestjs-cls";

import { requestIdOf } from "./request-id";

/**
 * What the API knows about the current request, read through `ClsService<RequestContext>`
 * instead of REQUEST-scoped providers. `getId()` returns the request id.
 */
export interface RequestContext extends ClsStore {
  /** Signed-in user; set by the session guard. */
  user?: AuthUser;
  /** School the request acts on, with the user's role in it; set by the roles guard. */
  school?: { id: string; role: MembershipRole };
}

/** Opens a request context around every request, keyed by the same id the logs use. */
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true, idGenerator: requestIdOf },
    }),
  ],
})
export class RequestContextModule {}
