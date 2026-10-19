import { defineConfig } from "vitest/config";

// Emails render to strings on the server, so the tests need no DOM.
export default defineConfig({ test: { environment: "node" } });
