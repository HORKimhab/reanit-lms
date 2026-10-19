import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { describe, expect, it } from "vitest";

import { startClientTelemetry } from "./client";
import { readTelemetryEnv } from "./env";

const DSN = "https://key@o1.ingest.sentry.io/1";

describe("startClientTelemetry", () => {
  it("starts neither Sentry nor PostHog when nothing is configured", () => {
    startClientTelemetry(readTelemetryEnv({}));

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("starts Sentry for the deployment when a DSN is set", () => {
    startClientTelemetry(readTelemetryEnv({ NEXT_PUBLIC_SENTRY_DSN: DSN, NEXT_PUBLIC_DEPLOY_ENV: "production" }));

    expect(Sentry.init).toHaveBeenCalledWith({ dsn: DSN, environment: "production" });
  });

  it("starts PostHog on the configured host with anonymous visitors when a key is set", () => {
    startClientTelemetry(readTelemetryEnv({ NEXT_PUBLIC_POSTHOG_KEY: "phc_test", NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com" }));

    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({ api_host: "https://eu.i.posthog.com", person_profiles: "identified_only" }),
    );
  });
});
