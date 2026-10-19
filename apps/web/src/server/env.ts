import { z } from "zod";

const serverEnvSchema = z.object({
  /** Where server code reaches `apps/api` directly, e.g. http://localhost:4000. Browsers go through `/api/*`. */
  API_URL: z.url(),
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

/** `host[:port]` that schools hang off, e.g. `reanit.com` or `localhost:3000`. */
const rootDomainSchema = z
  .string()
  .toLowerCase()
  .regex(/^[a-z0-9.-]+(:\d+)?$/)
  .optional();

/**
 * Reads the root domain for school subdomains. Separate from `getServerEnv` because the
 * proxy runs on every request and needs nothing else; unset disables subdomain routing.
 *
 * @param source Variables to read; `process.env` outside tests.
 * @returns The root domain, or undefined when unset.
 * @throws {z.ZodError} When `ROOT_DOMAIN` is not a host.
 */
export function getRootDomain(source: Record<string, string | undefined> = process.env): string | undefined {
  return rootDomainSchema.parse(source.ROOT_DOMAIN || undefined);
}
