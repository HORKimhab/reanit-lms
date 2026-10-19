import base from "@reanit/config/vitest";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  base,
  defineConfig({
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    test: {
      // e2e/ holds the Playwright specs (`pnpm e2e`).
      exclude: [...configDefaults.exclude, "e2e/**"],
      setupFiles: ["./src/test/navigation.ts", "./src/test/setup.ts"],
      // next-intl imports "next/navigation" without an extension, which only resolves when bundled.
      server: { deps: { inline: ["next-intl"] } },
    },
  }),
);
