import { Global, Module } from "@nestjs/common";

import { ENV, parseEnv } from "./env";

/**
 * Reads the process environment once, at boot.
 *
 * @returns The validated variables.
 * @throws {z.ZodError} When a variable is missing or malformed.
 */
function readEnv() {
  return parseEnv(process.env);
}

/** Provides the validated environment to every module under the `ENV` token. */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: readEnv }],
  exports: [ENV],
})
export class EnvModule {}
