import { NodeSDK } from "@opentelemetry/sdk-node";
import * as Sentry from "@sentry/nextjs";

import type { TelemetryEnv } from "./env";

/** The web app's name in traces. */
const SERVICE_NAME = "web";

/**
 * Starts server-side error reporting and tracing, each only when configured. Traces are the spans
 * Next.js emits itself (requests, rendering, fetches to the API). Sentry reports errors only and
 * leaves OpenTelemetry to the SDK started here.
 *
 * @param env Validated telemetry variables.
 */
export function startServerTelemetry(env: TelemetryEnv) {
  if (env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({ dsn: env.NEXT_PUBLIC_SENTRY_DSN, environment: env.NEXT_PUBLIC_DEPLOY_ENV, enableOpenTelemetrySetup: false });
  }
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) new NodeSDK({ serviceName: SERVICE_NAME }).start();
}
