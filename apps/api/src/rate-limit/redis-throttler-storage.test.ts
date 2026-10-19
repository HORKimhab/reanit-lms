import { Logger } from "@nestjs/common";
import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";

import { createRedisThrottlerStorage } from "./redis-throttler-storage";

const MINUTE_MS = 60_000;

/**
 * Builds a Redis whose script call answers with the given result.
 *
 * @param result What `eval` resolves to, or the error it rejects with.
 * @returns The fake connection and its `eval` spy.
 */
function redisAnswering(result: unknown) {
  const evalScript = result instanceof Error ? vi.fn().mockRejectedValue(result) : vi.fn().mockResolvedValue(result);
  return { redis: { eval: evalScript } as unknown as Redis, evalScript };
}

describe("createRedisThrottlerStorage", () => {
  it("counts the hit under the limit's name and reports seconds left", async () => {
    const { redis, evalScript } = redisAnswering([3, 59_001, 0]);

    const record = await createRedisThrottlerStorage(redis).increment("key", MINUTE_MS, 10, MINUTE_MS, "account");

    expect(record).toEqual({ totalHits: 3, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 });
    expect(evalScript).toHaveBeenCalledWith(expect.any(String), 2, "rate-limit:account:key:hits", "rate-limit:account:key:block", MINUTE_MS, 10, MINUTE_MS);
  });

  it("reports a blocked key with the seconds until it is let through", async () => {
    const { redis } = redisAnswering([11, -2, 30_000]);

    expect(await createRedisThrottlerStorage(redis).increment("key", MINUTE_MS, 10, MINUTE_MS, "ip")).toEqual({
      totalHits: 11,
      timeToExpire: 0,
      isBlocked: true,
      timeToBlockExpire: 30,
    });
  });

  it("lets the request through and warns when Redis fails", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const { redis } = redisAnswering(new Error("Connection is closed."));

    expect(await createRedisThrottlerStorage(redis).increment("key", MINUTE_MS, 10, MINUTE_MS, "ip")).toEqual({
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect(warn).toHaveBeenCalledWith("Rate limit not counted, Redis failed: Connection is closed.");
  });
});
