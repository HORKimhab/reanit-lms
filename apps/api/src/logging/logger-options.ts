import type { Options } from "pino-http";

import type { Env } from "../config/env";

/** Log paths that hold credentials; pino replaces their values with "[Redacted]". */
export const REDACTED_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'res.headers["set-cookie"]',
  "password",
  "*.password",
];

/**
 * Builds the HTTP logger settings: one JSON line per request, tagged with the id Fastify assigned.
 *
 * @param env Validated environment.
 * @returns Options for pino-http.
 */
export function loggerOptions(env: Env): Options {
  return {
    level: env.LOG_LEVEL,
    redact: REDACTED_PATHS,
  };
}
