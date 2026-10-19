import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // SWC emits the decorator metadata Nest's dependency injection reads; Vite's esbuild does not.
  plugins: [swc.vite()],
  test: { environment: "node", restoreMocks: true },
});
