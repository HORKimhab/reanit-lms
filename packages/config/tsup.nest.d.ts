import type { Options } from "tsup";

/**
 * Builds a Nest app's tsup config: an ESM bundle per entry for Node 24, with the workspace packages inlined.
 *
 * @param entry The app's entry files, e.g. ["src/main.ts"].
 * @returns The config.
 */
export function nestTsupConfig(entry: string[]): Options;
