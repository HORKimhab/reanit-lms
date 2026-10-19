import { Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";

/** Reports a dependency as up when a cheap probe (e.g. `SELECT 1`, `PING`) answers in time. */
@Injectable()
export class PingHealthIndicator {
  /**
   * Receives Terminus's indicator service.
   *
   * @param healthIndicatorService Builds indicator results.
   */
  constructor(private readonly healthIndicatorService: HealthIndicatorService) {}

  /**
   * Runs a probe against a dependency.
   *
   * @param key Name of the dependency in the health response.
   * @param probe Resolves when the dependency answers; rejects when it cannot.
   * @param timeoutMs How long to wait before reporting down.
   * @returns A pending check that resolves to up, or down with the error message.
   */
  pingCheck<Key extends string>(key: Key, probe: () => Promise<unknown>, timeoutMs: number) {
    return this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        await probe();
      })
      .withTimeout(timeoutMs);
  }
}
