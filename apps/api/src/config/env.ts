import { z } from "zod";

/** Injection token for the validated environment. */
export const ENV = Symbol("ENV");

const DEFAULT_PORT = 4000;

const envSchema = z.object({
  /** Postgres connection; see packages/db/.env.example. */
  DATABASE_URL: z.url(),
  /** Redis connection, e.g. redis://localhost:6379. */
  REDIS_URL: z.url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  /** Interface to listen on; all of them by default, as a container needs. */
  HOST: z.string().min(1).default("0.0.0.0"),
});

/** The API's validated environment. */
export type Env = z.infer<typeof envSchema>;

/**
 * Validates the environment so a misconfigured API fails at boot, not on the first request.
 *
 * @param source Variables to read.
 * @returns The validated variables with defaults applied.
 * @throws {z.ZodError} When a variable is missing or malformed.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}
