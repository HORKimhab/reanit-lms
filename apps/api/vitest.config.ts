import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // SWC emits the decorator metadata Nest's dependency injection reads; Vite's esbuild does not.
  plugins: [swc.vite()],
  test: {
    environment: "node",
    restoreMocks: true,
    projects: [
      { extends: true, test: { name: "unit", include: ["src/**/*.test.ts"] } },
      // Only the e2e project starts Postgres (Docker), once for all its files.
      {
        extends: true,
        test: { name: "e2e", include: ["test/**/*.e2e.test.ts"], globalSetup: ["@reanit/db/testing/postgres"] },
      },
    ],
  },
});
