import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

import type { TelemetryEnv } from "./env";

/** PostHog's recommended settings as of this date: pageviews and page leaves on client-side navigation. */
const POSTHOG_DEFAULTS = "2026-08-30";

/**
 * Starts browser error reporting and product analytics, each only when configured. PostHog keeps
 * visitors anonymous (no person profiles) until something identifies them.
 *
 * @param env Validated telemetry variables.
 */
export function startClientTelemetry(env: TelemetryEnv) {
  if (env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({ dsn: env.NEXT_PUBLIC_SENTRY_DSN, environment: env.NEXT_PUBLIC_DEPLOY_ENV });
  }
  if (env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
      defaults: POSTHOG_DEFAULTS,
      person_profiles: "identified_only",
    });
  }
}
