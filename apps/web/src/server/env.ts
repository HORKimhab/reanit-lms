import { z } from "zod";

const serverEnvSchema = z.object({
  /** Postgres connection; see packages/db/.env.example. */
  DATABASE_URL: z.url(),
  /** Public origin of the app, used to build links in emails. */
  APP_URL: z.url(),
  /** SMTP server, e.g. smtp://localhost:1025 for Mailpit. */
  SMTP_URL: z.url(),
  /** Sender of transactional email, e.g. `Reanit <no-reply@reanit.com>`. */
  MAIL_FROM: z.string().min(1),
});

/** Validated server-only environment variables. */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/**
 * Reads and validates the server environment on first use, so pages that never
 * touch the backend still build without it.
 *
 * @param source Variables to read; `process.env` outside tests.
 * @returns The validated variables.
 * @throws {z.ZodError} When a variable is missing or malformed.
 */
export function getServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  cached ??= serverEnvSchema.parse(source);
  return cached;
}
