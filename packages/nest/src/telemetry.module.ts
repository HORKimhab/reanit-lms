import { Injectable, Module, type OnApplicationShutdown } from "@nestjs/common";

import { flushTelemetry } from "./telemetry";

/** Flushes buffered errors and spans once the app has closed, before the process exits. */
@Injectable()
class TelemetryFlusher implements OnApplicationShutdown {
  /**
   * Runs after the other providers closed, so their last errors and spans are included.
   *
   * @returns Once everything is flushed or the timeout passed.
   */
  onApplicationShutdown() {
    return flushTelemetry();
  }
}

/** Flushes Sentry and OpenTelemetry on shutdown; `startTelemetry` in the app's `instrument.ts` starts them. */
@Module({ providers: [TelemetryFlusher] })
export class TelemetryModule {}
