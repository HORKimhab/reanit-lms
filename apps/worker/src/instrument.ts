// Preloaded with `node --import ./dist/instrument.js` so tracing patches modules before they load.
// package.json lists the Sentry and OpenTelemetry packages this uses (knip ignores them) so tsup keeps them
// external: instrument.js and main.js then share one copy, and the loader hook can resolve its file.
import { startTelemetry } from "@reanit/nest/telemetry";

startTelemetry("worker");
