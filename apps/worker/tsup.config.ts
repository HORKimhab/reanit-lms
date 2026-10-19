import { nestTsupConfig } from "@reanit/config/tsup-nest";
import type { Options } from "tsup";

const config: Options = nestTsupConfig(["src/main.ts"]);

export default config;
