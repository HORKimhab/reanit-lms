import { Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";

/** Long enough never to fire in practice; the timer only exists to hold the event loop. */
const KEEP_ALIVE_MS = 2 ** 30;

/**
 * Keeps the worker process running until a shutdown signal. A Nest application context has
 * no server to hold Node's event loop, and job processors may be paused or not registered.
 */
@Injectable()
export class KeepAlive implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;

  /** Starts holding the event loop once the worker has booted. */
  onApplicationBootstrap() {
    this.timer = setInterval(() => undefined, KEEP_ALIVE_MS);
  }

  /** Lets the process exit once shutdown has closed everything else. */
  onApplicationShutdown() {
    clearInterval(this.timer);
  }
}
