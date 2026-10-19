// Loaded by each app's `src/instrument.ts` through `node --import`, before any other module, so the
// SDKs can patch Nest, Fastify, ioredis and pino as they load. Keep Nest imports out of this file.
import { register } from "node:module";

import { ProxyTracerProvider, trace } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import * as Sentry from "@sentry/node";
import { z } from "zod";

/** How long shutdown waits for buffered errors and spans to reach their backends. */
const FLUSH_TIMEOUT_MS = 2000;

/**
 * Reads an unset or empty variable as absent, so `SENTRY_DSN=` in a compose file turns Sentry off.
 *
 * @param value The raw variable.
 * @returns The value, or undefined when empty.
 */
function emptyAsUnset(value: unknown) {
  return value === "" ? undefined : value;
}

/** Variables that turn on error reporting and tracing; both stay off when unset. */
export const telemetryEnvSchema = z.object({
  /** Sentry project DSN; errors are reported only when it is set. */
  SENTRY_DSN: z.preprocess(emptyAsUnset, z.url().optional()),
  /** Deployment the errors and traces belong to, e.g. `staging` or `production`. */
  DEPLOY_ENV: z.preprocess(emptyAsUnset, z.string().min(1).default("development")),
  /**
   * OTLP/HTTP collector, e.g. http://localhost:4318; traces are exported only when it is set.
   * The SDK reads the other standard OTEL_* variables itself (headers, sampler).
   */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(emptyAsUnset, z.url().optional()),
});

/** Instrumentations that would trace every file read and socket, drowning the request spans. */
const NOISY_INSTRUMENTATIONS = {
  "@opentelemetry/instrumentation-fs": { enabled: false },
  "@opentelemetry/instrumentation-dns": { enabled: false },
  "@opentelemetry/instrumentation-net": { enabled: false },
};

/**
 * Starts Sentry error reporting and OpenTelemetry tracing for one app, each only when configured.
 * Logs carry the trace id through the pino instrumentation.
 *
 * @param serviceName The app's name in errors and traces, e.g. `api`.
 * @param source Variables to read; `process.env` outside tests.
 * @throws {z.ZodError} When a telemetry variable is malformed.
 * @example
 * startTelemetry("api");
 */
export function startTelemetry(serviceName: string, source: Record<string, string | undefined> = process.env) {
  const env = telemetryEnvSchema.parse(source);
  if (env.SENTRY_DSN) {
    Sentry.init({ dsn: env.SENTRY_DSN, environment: env.DEPLOY_ENV, initialScope: { tags: { service: serviceName } } });
  }
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    // The apps' ESM bundles import Nest, Fastify and ioredis, which only an ESM loader hook can patch.
    register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);
    new NodeSDK({ serviceName, instrumentations: [getNodeAutoInstrumentations(NOISY_INSTRUMENTATIONS)] }).start();
  }
}

/**
 * Sends an error nobody expected to Sentry, tagged with the current trace id so the error links
 * to its trace. Does nothing when Sentry is off.
 *
 * @param error What was thrown.
 * @param tags Extra searchable tags, e.g. the failed job's name.
 * @example
 * reportError(error, { job: "OrderPaid" });
 */
export function reportError(error: unknown, tags: Record<string, string> = {}) {
  const traceId = trace.getActiveSpan()?.spanContext().traceId;
  Sentry.captureException(error, { tags: traceId ? { ...tags, trace_id: traceId } : tags });
}

/**
 * Sends the errors and spans still buffered, so the last ones before a shutdown are not lost.
 * The tracer provider is read from the OpenTelemetry global, as `startTelemetry` ran in another bundle.
 *
 * @returns Once both are flushed or the timeout passed.
 * @example
 * await flushTelemetry();
 */
export async function flushTelemetry() {
  const provider = trace.getTracerProvider();
  const tracer = provider instanceof ProxyTracerProvider ? provider.getDelegate() : provider;
  await Promise.all([
    Sentry.flush(FLUSH_TIMEOUT_MS),
    "forceFlush" in tracer && typeof tracer.forceFlush === "function" ? tracer.forceFlush() : undefined,
  ]);
}
