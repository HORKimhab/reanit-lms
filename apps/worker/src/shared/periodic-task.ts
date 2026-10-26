import { Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";

/**
 * Work the worker repeats on a timer from boot to shutdown, such as relaying the outbox. A tick never
 * starts a run while the last one is still going, a failed run is logged and retried on the next tick,
 * and shutdown waits for the run in progress. The timer also keeps the worker process alive.
 */
export abstract class PeriodicTask implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(this.constructor.name);
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> | undefined;

  /**
   * Sets how often the task runs and what a failure is logged as.
   *
   * @param intervalMs Time between ticks.
   * @param failureMessage The log message of a failed run.
   */
  protected constructor(
    private readonly intervalMs: number,
    private readonly failureMessage: string,
  ) {}

  /**
   * Does the work once.
   *
   * @returns Resolves when the run is over.
   */
  protected abstract runOnce(): Promise<unknown>;

  /** Starts the timer once the worker has booted. */
  onApplicationBootstrap() {
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  /** Stops the timer and waits for the run in progress, so its transaction ends before the database closes. */
  async onApplicationShutdown() {
    clearInterval(this.timer);
    await this.running;
  }

  /** Starts a run unless one is still going; a failed run is logged and retried on the next tick. */
  private tick() {
    if (this.running) return;
    this.running = this.runOnce()
      // The timer is the loop's top level: nothing above it could handle the error, and the next tick retries.
      .then(() => undefined, (error: unknown) => this.logger.error(error, this.failureMessage))
      .finally(() => {
        this.running = undefined;
      });
  }
}
