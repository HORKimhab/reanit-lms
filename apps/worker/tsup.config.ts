import { defineConfig } from "tsup";

// Bundles the app with the workspace packages it imports, which ship TypeScript source.
// tsup compiles with SWC because tsconfig enables emitDecoratorMetadata, which esbuild lacks.
export default defineConfig({
  entry: ["src/main.ts"],
  format: "esm",
  platform: "node",
  target: "node24",
  sourcemap: true,
  clean: true,
  noExternal: [/^@reanit\//],
  // Bundled CommonJS code (pg, via @reanit/db) calls require(), which ESM output lacks.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
