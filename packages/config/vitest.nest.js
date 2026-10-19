// Shared Vitest preset for the Nest apps (apps/api, apps/worker): unit tests next to the source,
// and one project for the tests that start Docker containers.
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/**
 * Builds a Nest app's Vitest config. SWC emits the decorator metadata Nest's dependency injection reads; Vite's esbuild does not.
 *
 * @param docker The project of tests that need Docker.
 * @param docker.name The project's name, e.g. "e2e".
 * @param docker.include Its test files.
 * @param docker.globalSetup Setup files that start the containers, once for all its files.
 * @returns The config.
 * @example
 * export default nestVitestConfig({ name: "e2e", include: ["test/**\/*.e2e.test.ts"], globalSetup: ["@reanit/db/testing/postgres"] });
 */
export function nestVitestConfig({ name, include, globalSetup }) {
  return defineConfig({
    plugins: [swc.vite()],
    test: {
      environment: "node",
      restoreMocks: true,
      projects: [
        { extends: true, test: { name: "unit", include: ["src/**/*.test.ts"] } },
        { extends: true, test: { name, include, globalSetup } },
      ],
    },
  });
}
