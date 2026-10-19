import { describe, expect, it } from "vitest";

import { readTelemetryEnv } from "./env";

describe("readTelemetryEnv", () => {
  it("leaves every service off and uses the defaults when nothing is set", () => {
    expect(readTelemetryEnv({})).toEqual({
      NEXT_PUBLIC_DEPLOY_ENV: "development",
      NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
    });
  });

  it("reads empty variables as unset", () => {
    const env = readTelemetryEnv({ NEXT_PUBLIC_SENTRY_DSN: "", NEXT_PUBLIC_POSTHOG_KEY: "", NEXT_PUBLIC_DEPLOY_ENV: "" });

    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
    expect(env.NEXT_PUBLIC_POSTHOG_KEY).toBeUndefined();
    expect(env.NEXT_PUBLIC_DEPLOY_ENV).toBe("development");
  });

  it("throws when the Sentry DSN is not a URL", () => {
    expect(() => readTelemetryEnv({ NEXT_PUBLIC_SENTRY_DSN: "not-a-dsn" })).toThrow();
  });
});
