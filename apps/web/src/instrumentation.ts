import * as Sentry from "@sentry/nextjs";

/**
 * Starts server telemetry once per server process. The Node SDKs are loaded only in the Node.js
 * runtime, since the Edge runtime cannot run them.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ readTelemetryEnv }, { startServerTelemetry }] = await Promise.all([import("./telemetry/env"), import("./telemetry/server")]);
  startServerTelemetry(readTelemetryEnv());
}

/** Reports errors thrown while rendering, in route handlers and in server actions to Sentry. */
export const onRequestError = Sentry.captureRequestError;
