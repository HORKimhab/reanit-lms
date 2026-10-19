import type { Clock } from "@reanit/core/auth";

/** The real clock for the use cases that read the time; tests replace the services that use it. */
export const systemClock: Clock = {
  /**
   * Reads the system time.
   *
   * @returns The current time.
   */
  now: () => new Date(),
};
