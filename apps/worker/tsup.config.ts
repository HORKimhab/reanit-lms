import { nestTsupConfig } from "@reanit/config/tsup-nest";
import type { Options } from "tsup";

const config: Options = {
  ...nestTsupConfig(["src/instrument.ts", "src/main.ts"]),
  // Certificate fonts ship inside the bundle, so the image needs no files beside dist/main.js.
  loader: { ".ttf": "binary" },
};

export default config;
