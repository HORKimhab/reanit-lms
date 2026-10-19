import { applyDecorators, Global, Module, UseGuards } from "@nestjs/common";
import { SkipThrottle, Throttle, ThrottlerModule, type ThrottlerModuleOptions } from "@nestjs/throttler";
import type { Redis } from "ioredis";
import { ClsServiceManager } from "nestjs-cls";

import type { RequestContext } from "../context/request-context";
import { REDIS } from "../redis/redis.module";
import { createRedisThrottlerStorage } from "./redis-throttler-storage";
import { RateLimitGuard } from "./rate-limit.guard";

const MINUTE_MS = 60 * 1000;

/** A limit per window. */
type Limit = { limit: number; ttl: number };

/**
 * Limits per route: `ip` counts every caller from one address; `account` counts attempts on one
 * email (sign-in) or by one user (checkout, comments), wherever they come from.
 */
export const RATE_LIMITS = {
  signUp: { ip: { limit: 10, ttl: 60 * MINUTE_MS } },
  logIn: { ip: { limit: 30, ttl: 15 * MINUTE_MS }, account: { limit: 10, ttl: 15 * MINUTE_MS } },
  magicLink: { ip: { limit: 10, ttl: 15 * MINUTE_MS }, account: { limit: 5, ttl: 60 * MINUTE_MS } },
  verifyMagicLink: { ip: { limit: 30, ttl: 15 * MINUTE_MS } },
  checkout: { ip: { limit: 30, ttl: 10 * MINUTE_MS }, account: { limit: 10, ttl: 10 * MINUTE_MS } },
  comment: { ip: { limit: 60, ttl: 10 * MINUTE_MS }, account: { limit: 20, ttl: 10 * MINUTE_MS } },
} satisfies Record<string, { ip: Limit; account?: Limit }>;

/**
 * Identifies whose attempts the `account` limit counts: the signed-in user, or the email a sign-in
 * form names (lower-cased, as accounts are matched), or the caller's address when there is neither.
 *
 * @param request The raw request; its body is not validated yet, so it is read defensively.
 * @param request.ip The caller's address.
 * @param request.body The request body, if any.
 * @returns The tracker.
 */
function accountTracker({ ip, body }: Record<string, unknown>): string {
  const user = ClsServiceManager.getClsService<RequestContext>().get("user");
  if (user) return `user:${user.id}`;
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? `email:${email.trim().toLowerCase()}` : `ip:${String(ip)}`;
}

/**
 * Builds the limits' options: counters in Redis, and the two named limits with their trackers.
 * Each route sets its own numbers with `@RateLimit`; these defaults are never used alone.
 *
 * @param redis The shared Redis connection.
 * @returns The throttler options.
 */
function throttlerOptions(redis: Redis): ThrottlerModuleOptions {
  return {
    storage: createRedisThrottlerStorage(redis),
    throttlers: [
      { name: "ip", ...RATE_LIMITS.signUp.ip },
      { name: "account", ...RATE_LIMITS.logIn.account, getTracker: accountTracker },
    ],
  };
}

/**
 * Limits a route to its preset in `RATE_LIMITS`; passing it answers 429 with `Retry-After`.
 *
 * @param preset The route's limits.
 * @returns The decorator.
 */
export function RateLimit(preset: keyof typeof RATE_LIMITS) {
  const { ip, account }: { ip: Limit; account?: Limit } = RATE_LIMITS[preset];
  return applyDecorators(UseGuards(RateLimitGuard), Throttle(account ? { ip, account } : { ip }), SkipThrottle({ account: !account }));
}

/** Rate limiting for any module whose routes use `@RateLimit`. */
@Global()
@Module({
  imports: [ThrottlerModule.forRootAsync({ inject: [REDIS], useFactory: throttlerOptions })],
  providers: [RateLimitGuard],
  exports: [ThrottlerModule, RateLimitGuard],
})
export class RateLimitModule {}
