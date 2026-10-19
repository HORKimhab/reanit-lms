// Runs in the browser before the app hydrates.
import { readTelemetryEnv } from "./telemetry/env";
import { startClientTelemetry } from "./telemetry/client";

startClientTelemetry(readTelemetryEnv());
