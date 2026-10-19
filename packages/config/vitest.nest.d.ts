import type { UserConfig } from "vitest/config";

/**
 * Builds a Nest app's Vitest config: unit tests next to the source, plus one project of tests that need Docker.
 *
 * @param docker The project of tests that need Docker.
 * @param docker.name The project's name, e.g. "e2e".
 * @param docker.include Its test files.
 * @param docker.globalSetup Setup files that start the containers, once for all its files.
 * @returns The config.
 */
export function nestVitestConfig(docker: { name: string; include: string[]; globalSetup: string[] }): UserConfig;
