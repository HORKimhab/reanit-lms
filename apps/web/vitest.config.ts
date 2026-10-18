import base from "@reanit/config/vitest";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  base,
  defineConfig({
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    test: {
      setupFiles: ["./src/test/navigation.ts", "./src/test/setup.ts"],
      // next-intl imports "next/navigation" without an extension, which only resolves when bundled.
      server: { deps: { inline: ["next-intl"] } },
    },
  }),
);
