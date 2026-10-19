// Shared tsup preset for the Nest apps (apps/api, apps/worker): one ESM bundle per entry for Node,
// with the workspace packages inlined, since they ship TypeScript source.
import { defineConfig } from "tsup";

/**
 * Builds a Nest app's tsup config. tsup compiles with SWC because the apps' tsconfig enables
 * emitDecoratorMetadata, which esbuild lacks.
 *
 * @param entry The app's entry files, e.g. ["src/main.ts"].
 * @returns The config.
 * @example
 * export default nestTsupConfig(["src/main.ts"]);
 */
export function nestTsupConfig(entry) {
  return defineConfig({
    entry,
    format: "esm",
    platform: "node",
    target: "node24",
    sourcemap: true,
    clean: true,
    noExternal: [/^@reanit\//],
    // Bundled CommonJS code (pg, via @reanit/db) calls require(), which ESM output lacks.
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    // @reanit/email's React templates need the automatic JSX runtime; SWC's default emits `React.createElement` without importing React.
    swc: { jsc: { transform: { react: { runtime: "automatic" } } } },
  });
}
