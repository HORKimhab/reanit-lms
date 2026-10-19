import { Global, Inject, Logger, Module, type OnApplicationShutdown } from "@nestjs/common";
import { Redis } from "ioredis";

import { ENV, type Env } from "../config/env";

/** Injection token for the shared Redis connection. */
export const REDIS = Symbol("REDIS");

/**
 * Opens the Redis connection. Commands fail fast while disconnected instead of queueing,
 * so the health check reports Redis down rather than hanging; the client keeps reconnecting.
 *
 * @param env Validated environment.
 * @returns The connection.
 */
function connectRedis(env: Env) {
  const redis = new Redis(env.REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
  const logger = new Logger("Redis");
  // Without a listener ioredis reports each failed reconnect as an unhandled error event.
  // Connection failures (e.g. ECONNREFUSED) carry only a code, no message.
  redis.on("error", (error: NodeJS.ErrnoException) => logger.warn(error.message || error.code || error.name));
  return redis;
}

/** Provides one Redis connection to every module and closes it on shutdown. */
@Global()
@Module({
  providers: [{ provide: REDIS, inject: [ENV], useFactory: connectRedis }],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  /**
   * Receives the connection so it can be closed on shutdown.
   *
   * @param redis The shared connection.
   */
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Closes the connection after pending replies arrive, or at once when Redis is unreachable (QUIT cannot be sent then). */
  async onApplicationShutdown() {
    if (this.redis.status === "ready") await this.redis.quit();
    else this.redis.disconnect();
  }
}
