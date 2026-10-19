import { Global, Module, type DynamicModule } from "@nestjs/common";
import { z } from "zod";

/** Injection token for the validated environment of the running app. */
export const ENV = Symbol("ENV");

/** Variables every Nest app here needs; each app extends it with its own. */
export const baseEnvSchema = z.object({
  /** Postgres connection; see packages/db/.env.example. */
  DATABASE_URL: z.url(),
  /** Redis connection, e.g. redis://localhost:6379. */
  REDIS_URL: z.url(),
  /** Lowest pino level written; `silent` turns logging off. */
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

/** The variables the shared modules read. */
export type BaseEnv = z.infer<typeof baseEnvSchema>;

/** Provides the validated environment to every module under the `ENV` token. */
@Global()
@Module({})
export class EnvModule {
  /**
   * Reads the process environment once, at boot, so a misconfigured app fails before serving.
   *
   * @param parse The app's parser, e.g. `(source) => envSchema.parse(source)`.
   * @returns The module.
   * @example
   * EnvModule.forRoot((source) => baseEnvSchema.parse(source))
   */
  static forRoot(parse: (source: Record<string, string | undefined>) => BaseEnv): DynamicModule {
    /**
     * Parses the process environment.
     *
     * @returns The validated variables.
     * @throws {z.ZodError} When a variable is missing or malformed.
     */
    function readEnv() {
      return parse(process.env);
    }
    return {
      module: EnvModule,
      providers: [{ provide: ENV, useFactory: readEnv }],
      exports: [ENV],
    };
  }
}
