import { vi } from "vitest";

// Test doubles for the telemetry vendors: Sentry and PostHog are boundaries, so tests inspect what was sent.
vi.mock("@sentry/nextjs", () => ({ init: vi.fn(), captureException: vi.fn(), captureRequestError: vi.fn() }));
vi.mock("posthog-js", () => ({ default: { init: vi.fn() } }));
vi.mock("@opentelemetry/sdk-node", () => ({ NodeSDK: vi.fn(/** Stand-in for the OpenTelemetry SDK, recording `start`. */ class { start = vi.fn(); }) }));
