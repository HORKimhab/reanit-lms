import { baseEnvSchema } from "@reanit/nest";
import { z } from "zod";

const DEFAULT_PORT = 4000;

const envSchema = baseEnvSchema.extend({
  /** Public origin of the web app: builds links in emails, decides the Secure cookie flag and which origins may send mutating requests. */
  APP_URL: z.url(),
  /** SMTP server, e.g. smtp://localhost:1025 for Mailpit. */
  SMTP_URL: z.url(),
  /** Sender of transactional email, e.g. `Reanit <no-reply@reanit.com>`. */
  MAIL_FROM: z.string().min(1),
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
