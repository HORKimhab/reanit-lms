import { Module } from "@nestjs/common";
import { LoggerModule, type Params } from "nestjs-pino";

import { ENV, type BaseEnv } from "./env";

/** Log paths that hold credentials; pino replaces their values with "[Redacted]". */
export const REDACTED_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'res.headers["set-cookie"]',
  "password",
  "*.password",
];

/**
 * Builds the logger settings: JSON lines at the configured level with credentials redacted.
 * In the API they also get one line per request, tagged with the request id.
 *
 * @param env Validated environment.
 * @returns Options for pino (through pino-http).
 * @example
 * loggerOptions({ ...env, LOG_LEVEL: "debug" })
 */
export function loggerOptions(env: Pick<BaseEnv, "LOG_LEVEL">) {
  return { level: env.LOG_LEVEL, redact: REDACTED_PATHS };
}

/**
 * Wraps the logger settings in the shape nestjs-pino expects.
 *
 * @param env Validated environment.
 * @returns nestjs-pino parameters.
 */
function loggerParams(env: BaseEnv): Params {
  return { pinoHttp: loggerOptions(env) };
}

/** Structured JSON logs through pino for Nest's own logs (and, in the API, one line per request). */
@Module({
  imports: [LoggerModule.forRootAsync({ inject: [ENV], useFactory: loggerParams })],
})
export class LoggingModule {}
