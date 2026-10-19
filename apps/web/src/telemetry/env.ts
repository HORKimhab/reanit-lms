import { z } from "zod";

/** PostHog's US cloud; set NEXT_PUBLIC_POSTHOG_HOST for the EU cloud or a reverse proxy. */
const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

/**
 * Reads an empty variable as absent, so `NEXT_PUBLIC_SENTRY_DSN=` turns Sentry off.
 *
 * @param value The raw variable.
 * @returns The value, or undefined when empty.
 */
function emptyAsUnset(value: unknown) {
  return value === "" ? undefined : value;
}

const telemetryEnvSchema = z.object({
  /** Sentry DSN of the web project, used by the server and the browser; errors are reported only when set. */
  NEXT_PUBLIC_SENTRY_DSN: z.preprocess(emptyAsUnset, z.url().optional()),
  /** Deployment the errors belong to, e.g. `staging` or `production`. */
  NEXT_PUBLIC_DEPLOY_ENV: z.preprocess(emptyAsUnset, z.string().min(1).default("development")),
  /** PostHog project key; product analytics run only when it is set. */
  NEXT_PUBLIC_POSTHOG_KEY: z.preprocess(emptyAsUnset, z.string().min(1).optional()),
  NEXT_PUBLIC_POSTHOG_HOST: z.preprocess(emptyAsUnset, z.url().default(DEFAULT_POSTHOG_HOST)),
  /** Server only: OTLP/HTTP collector for traces, e.g. http://localhost:4318; tracing stays off when unset. */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(emptyAsUnset, z.url().optional()),
});

/** Validated variables that turn on error reporting, tracing and product analytics. */
export type TelemetryEnv = z.infer<typeof telemetryEnvSchema>;

/**
 * Validates the telemetry variables. Each is named in full, because Next inlines a
 * `NEXT_PUBLIC_*` variable into the browser bundle only where it reads it by name.
 *
 * @param source Variables to read; the process environment outside tests.
 * @returns The validated variables with defaults applied.
 * @throws {z.ZodError} When a variable is malformed.
 */
export function readTelemetryEnv(
  source: Record<string, string | undefined> = {
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_DEPLOY_ENV: process.env.NEXT_PUBLIC_DEPLOY_ENV,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  },
): TelemetryEnv {
  return telemetryEnvSchema.parse(source);
}
