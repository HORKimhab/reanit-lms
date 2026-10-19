import { trace, TraceFlags, type TracerProvider } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import * as Sentry from "@sentry/node";
import { register } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { flushTelemetry, reportError, startTelemetry } from "./telemetry";

vi.mock("node:module", () => ({ register: vi.fn() }));
vi.mock("@sentry/node", () => ({ init: vi.fn(), captureException: vi.fn(), flush: vi.fn().mockResolvedValue(true) }));
vi.mock("@opentelemetry/sdk-node", () => ({ NodeSDK: vi.fn(/** Stand-in for the OpenTelemetry SDK, recording `start`. */ class { start = vi.fn(); }) }));

const DSN = "https://key@o1.ingest.sentry.io/1";
const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const SPAN_ID = "00f067aa0ba902b7";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("startTelemetry", () => {
  it("starts neither Sentry nor tracing when nothing is configured", () => {
    startTelemetry("api", {});

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
    expect(NodeSDK).not.toHaveBeenCalled();
  });

  it("starts Sentry for the deployment, tagged with the service, when a DSN is set", () => {
    startTelemetry("api", { SENTRY_DSN: DSN, DEPLOY_ENV: "staging" });

    expect(Sentry.init).toHaveBeenCalledWith({ dsn: DSN, environment: "staging", initialScope: { tags: { service: "api" } } });
  });

  it("reports to the development environment when DEPLOY_ENV is unset", () => {
    startTelemetry("worker", { SENTRY_DSN: DSN });

    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ environment: "development" }));
  });

  it("keeps Sentry off when the DSN is empty", () => {
    startTelemetry("api", { SENTRY_DSN: "" });

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("starts tracing for the service when an OTLP endpoint is set", () => {
    startTelemetry("worker", { OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318" });

    expect(register).toHaveBeenCalledWith("@opentelemetry/instrumentation/hook.mjs", expect.any(String));
    expect(NodeSDK).toHaveBeenCalledWith(expect.objectContaining({ serviceName: "worker" }));
    expect(vi.mocked(NodeSDK).mock.instances[0]?.start).toHaveBeenCalled();
  });

  it("throws when the DSN is not a URL", () => {
    expect(() => startTelemetry("api", { SENTRY_DSN: "not-a-dsn" })).toThrow();
  });
});

describe("reportError", () => {
  it("sends the error with its tags when no trace is active", () => {
    const error = new Error("boom");

    reportError(error, { event: "OrderPaid" });

    expect(Sentry.captureException).toHaveBeenCalledWith(error, { tags: { event: "OrderPaid" } });
  });

  it("tags the error with the active trace id", () => {
    vi.spyOn(trace, "getActiveSpan").mockReturnValue(trace.wrapSpanContext({ traceId: TRACE_ID, spanId: SPAN_ID, traceFlags: TraceFlags.SAMPLED }));
    const error = new Error("boom");

    reportError(error);

    expect(Sentry.captureException).toHaveBeenCalledWith(error, { tags: { trace_id: TRACE_ID } });
  });
});

describe("flushTelemetry", () => {
  it("flushes Sentry and the tracer provider's buffered spans", async () => {
    const forceFlush = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(trace, "getTracerProvider").mockReturnValue({ getTracer: vi.fn(), forceFlush } as TracerProvider);

    await flushTelemetry();

    expect(Sentry.flush).toHaveBeenCalled();
    expect(forceFlush).toHaveBeenCalled();
  });

  it("flushes Sentry without failing when tracing is off", async () => {
    await flushTelemetry();

    expect(Sentry.flush).toHaveBeenCalled();
  });
});
