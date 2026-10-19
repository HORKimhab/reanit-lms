import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import * as Sentry from "@sentry/node";
import { describe, expect, it, vi } from "vitest";

import { TelemetryModule } from "./telemetry.module";

vi.mock("@sentry/node", () => ({ flush: vi.fn().mockResolvedValue(true) }));

describe("TelemetryModule", () => {
  it("flushes buffered errors when the app shuts down", async () => {
    const app = await NestFactory.createApplicationContext(TelemetryModule, { logger: false });

    await app.close();

    expect(Sentry.flush).toHaveBeenCalled();
  });
});
