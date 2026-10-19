import { Injectable, type ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard, type ThrottlerLimitDetail } from "@nestjs/throttler";
import type { FastifyReply } from "fastify";

/** `@nestjs/throttler`'s guard, also sending the standard `Retry-After` header; its own carries the limit's name (`Retry-After-account`). */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  /**
   * Tells the caller how many seconds to wait, then refuses the request.
   *
   * @param context The request.
   * @param detail The limit that was passed.
   * @throws {ThrottlerException} Always (429).
   */
  protected override async throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    context.switchToHttp().getResponse<FastifyReply>().header("Retry-After", detail.timeToBlockExpire);
    await super.throwThrottlingException(context, detail);
  }
}
