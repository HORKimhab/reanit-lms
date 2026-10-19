// Rate-limit storage for tests: the test apps never block unless a test asks for real counting.
import { getStorageToken, type ThrottlerStorage } from "@nestjs/throttler";

/** Token of the rate-limit counters; pass it in a test app's `overrides` to count for real. */
export const RATE_LIMIT_STORAGE = getStorageToken();

/** Counters that never block, so tests that are not about rate limits can send as many requests as they need. */
export const UNLIMITED_RATE: ThrottlerStorage = {
  /**
   * Counts nothing.
   *
   * @returns One hit, never blocked.
   */
  async increment() {
    return { totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
  },
};
