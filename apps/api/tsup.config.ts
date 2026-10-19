import { nestTsupConfig } from "@reanit/config/tsup-nest";
import type { Options } from "tsup";

const config: Options = nestTsupConfig(["src/instrument.ts", "src/main.ts", "src/openapi.ts", "src/storage-setup.ts"]);

export default config;
