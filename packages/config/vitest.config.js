// Shared Vitest preset. Packages merge it into their own vitest.config.ts.
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: [fileURLToPath(new URL("./vitest.setup.js", import.meta.url))],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
