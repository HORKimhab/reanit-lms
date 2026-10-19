import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";

import { ENV, type Env } from "../config/env";
import { loggerOptions } from "./logger-options";

/**
 * Wraps the logger settings in the shape nestjs-pino expects.
 *
 * @param env Validated environment.
 * @returns nestjs-pino parameters.
 */
function loggerParams(env: Env) {
  return { pinoHttp: loggerOptions(env) };
}

/** Structured JSON logs through pino, for Nest's own logs and one line per request. */
@Module({
  imports: [LoggerModule.forRootAsync({ inject: [ENV], useFactory: loggerParams })],
})
export class LoggingModule {}
