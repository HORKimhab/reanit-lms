import { Controller, Get, Inject } from "@nestjs/common";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import type { DbClient } from "@reanit/db";
import type { Redis } from "ioredis";

import { DB_CLIENT } from "../db/db.module";
import { REDIS } from "../redis/redis.module";
import { PingHealthIndicator } from "./ping.health";

/** Longest a dependency may take to answer before it counts as down. */
export const PING_TIMEOUT_MS = 1000;

/** `GET /health` for load balancers and deploys: 200 when Postgres and Redis answer, 503 otherwise. */
@Controller("health")
export class HealthController {
  /**
   * Receives the checks it runs and the clients they probe.
   *
   * @param health Runs indicators and builds the response.
   * @param ping Times a probe against a dependency.
   * @param db The shared database client.
   * @param redis The shared Redis connection.
   */
  constructor(
    private readonly health: HealthCheckService,
    private readonly ping: PingHealthIndicator,
    @Inject(DB_CLIENT) private readonly db: Pick<DbClient, "$queryRaw">,
    @Inject(REDIS) private readonly redis: Pick<Redis, "ping">,
  ) {}

  /**
   * Checks every dependency the API needs to serve requests.
   *
   * @returns Each dependency's status.
   * @throws {ServiceUnavailableException} When any dependency is down (Terminus answers 503).
   */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.ping.pingCheck("postgres", () => this.db.$queryRaw`SELECT 1`, PING_TIMEOUT_MS),
      () => this.ping.pingCheck("redis", () => this.redis.ping(), PING_TIMEOUT_MS),
    ]);
  }
}
