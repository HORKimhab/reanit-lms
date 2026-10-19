import { Logger } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { Redis } from "ioredis";

const MS_PER_SECOND = 1000;

/**
 * Counts one hit atomically: while the key is blocked, nothing is counted; otherwise the hit starts
 * or extends a fixed window, and passing the limit blocks the key and starts the window over.
 * KEYS: hits, block. ARGV: window (ms), limit, block (ms). Returns hits, window left (ms), block left (ms).
 */
const INCREMENT_SCRIPT = `
local blockLeft = redis.call('PTTL', KEYS[2])
if blockLeft > 0 then
  return { tonumber(redis.call('GET', KEYS[1]) or '0'), redis.call('PTTL', KEYS[1]), blockLeft }
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local windowLeft = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  redis.call('DEL', KEYS[1])
  return { hits, windowLeft, tonumber(ARGV[3]) }
end
return { hits, windowLeft, 0 }
`;

/** What storage reports for one hit. */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage["increment"]>>;

/** What is reported while Redis cannot count: nothing counted, nothing blocked. */
const UNCOUNTED: ThrottlerStorageRecord = { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };

/**
 * Keeps rate-limit counters in Redis, so every API instance shares them. When Redis is down,
 * requests are let through (and a warning logged): sign-in and checkout stay up, unthrottled, until it is back.
 *
 * @param redis The shared Redis connection.
 * @returns Storage for `@nestjs/throttler`.
 */
export function createRedisThrottlerStorage(redis: Redis): ThrottlerStorage {
  const logger = new Logger("RateLimit");
  return {
    /**
     * Counts a hit on a key.
     *
     * @param key The throttled route and caller, hashed.
     * @param ttl Window length in ms.
     * @param limit Hits allowed per window.
     * @param blockDuration How long passing the limit blocks the key, in ms.
     * @param throttlerName Which limit this is (e.g. "ip" or "account").
     * @returns Hits so far, and seconds until the window and any block end.
     */
    async increment(key, ttl, limit, blockDuration, throttlerName) {
      const prefix = `rate-limit:${throttlerName}:${key}`;
      try {
        const [hits, windowLeft, blockLeft] = (await redis.eval(INCREMENT_SCRIPT, 2, `${prefix}:hits`, `${prefix}:block`, ttl, limit, blockDuration)) as [
          number,
          number,
          number,
        ];
        return {
          totalHits: hits,
          timeToExpire: Math.max(0, Math.ceil(windowLeft / MS_PER_SECOND)),
          isBlocked: blockLeft > 0,
          timeToBlockExpire: Math.max(0, Math.ceil(blockLeft / MS_PER_SECOND)),
        };
      } catch (error) {
        // Failing open is the handling: an outage must not lock everyone out of signing in or paying.
        logger.warn(`Rate limit not counted, Redis failed: ${(error as Error).message}`);
        return UNCOUNTED;
      }
    },
  };
}
