import { Inject, Injectable, Logger, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ClsService } from "nestjs-cls";
import { mergeMap, type Observable } from "rxjs";

import type { RequestContext } from "../context/request-context";
import { AUDITED, type AuditedRoute } from "./audit.decorator";
import { AUDIT_FOR_SCHOOL, type AuditFor } from "./audit.tokens";

/** Writes an audit entry after each successful call of an `@Audited` route; failed calls change nothing, so they are not recorded. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  /**
   * Receives what recording needs.
   *
   * @param reflector Reads `@Audited`.
   * @param cls The request context: the caller, their school and the request id.
   * @param auditFor Builds a school's audit log.
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService<RequestContext>,
    @Inject(AUDIT_FOR_SCHOOL) private readonly auditFor: AuditFor,
  ) {}

  /**
   * Records the call once the handler has succeeded, before the response is sent.
   *
   * @param context The request.
   * @param next The handler.
   * @returns The handler's response, unchanged.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const route = this.reflector.get<AuditedRoute | undefined>(AUDITED, context.getHandler());
    if (!route) return next.handle();
    const { params } = context.switchToHttp().getRequest<{ params: Record<string, string> }>();
    return next.handle().pipe(
      mergeMap(async (response: unknown) => {
        await this.record(route, params, response);
        return response;
      }),
    );
  }

  /**
   * Writes the entry. The action has already happened, so a failed write is logged as an error
   * rather than turned into an error response the caller might retry.
   *
   * @param route The route's action, target and school.
   * @param route.action What the route does.
   * @param route.target Finds the id of what it acted on.
   * @param route.schoolOf Finds the school in the response, for a route outside a staff school.
   * @param params The call's path params.
   * @param response The handler's response body.
   */
  private async record({ action, target, schoolOf }: AuditedRoute, params: Record<string, string>, response: unknown) {
    // @Audited routes need a session, so the session guard has set the user. Without schoolOf they
    // are @Roles routes, so the roles guard has set the school.
    const user = this.cls.get("user")!;
    const schoolId = schoolOf ? schoolOf(response) : this.cls.get("school")!.id;
    const entry = { actorId: user.id, action, targetId: target({ params, response, schoolId }), requestId: this.cls.getId() };
    try {
      await this.auditFor(schoolId).record(entry);
    } catch (error) {
      this.logger.error(error, `Audit entry not written: ${JSON.stringify(entry)}`);
    }
  }
}
