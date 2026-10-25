import { readFile } from "node:fs/promises";

import { nestVitestConfig } from "@reanit/config/vitest-nest";
import { mergeConfig, type Plugin } from "vitest/config";

/**
 * Loads font files as their bytes, as tsup's `binary` loader does in the build.
 *
 * @returns The Vite plugin.
 */
function bytes(): Plugin {
  return {
    name: "bytes",
    enforce: "pre",
    /**
     * Turns a `.ttf` import into a module exporting the file's bytes.
     *
     * @param id The imported file's path.
     * @returns The module's code, or undefined for any other file.
     */
    async load(id) {
      if (!id.endsWith(".ttf")) return undefined;
      const base64 = (await readFile(id)).toString("base64");
      return `export default new Uint8Array(Buffer.from("${base64}", "base64"));`;
    },
  };
}

// The integration project starts Postgres and Redis (Docker), once for all its files.
export default mergeConfig(
  nestVitestConfig({
    name: "integration",
    include: ["test/**/*.int.test.ts"],
    globalSetup: ["@reanit/db/testing/postgres", "@reanit/nest/testing/redis"],
  }),
  { plugins: [bytes()] },
);
