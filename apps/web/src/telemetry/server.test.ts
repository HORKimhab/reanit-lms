import { NodeSDK } from "@opentelemetry/sdk-node";
import * as Sentry from "@sentry/nextjs";
import { describe, expect, it, vi } from "vitest";

import { readTelemetryEnv } from "./env";
import { startServerTelemetry } from "./server";

const DSN = "https://key@o1.ingest.sentry.io/1";

describe("startServerTelemetry", () => {
  it("starts neither Sentry nor tracing when nothing is configured", () => {
    startServerTelemetry(readTelemetryEnv({}));

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(NodeSDK).not.toHaveBeenCalled();
  });

  it("starts Sentry for errors only, leaving OpenTelemetry to the tracing SDK", () => {
    startServerTelemetry(readTelemetryEnv({ NEXT_PUBLIC_SENTRY_DSN: DSN, NEXT_PUBLIC_DEPLOY_ENV: "staging" }));

    expect(Sentry.init).toHaveBeenCalledWith({ dsn: DSN, environment: "staging", enableOpenTelemetrySetup: false });
  });

  it("starts tracing as the web service when an OTLP endpoint is set", () => {
    startServerTelemetry(readTelemetryEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318" }));

    expect(NodeSDK).toHaveBeenCalledWith({ serviceName: "web" });
    expect(vi.mocked(NodeSDK).mock.instances[0]?.start).toHaveBeenCalled();
  });
});
