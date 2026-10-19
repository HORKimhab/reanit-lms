import { z } from "zod";

/** DNS label limits; 3 keeps out ambiguous one- and two-letter names. */
const SUBDOMAIN_MIN_LENGTH = 3;
const SUBDOMAIN_MAX_LENGTH = 63;
const SCHOOL_NAME_MAX_LENGTH = 100;

/** Lowercase letters, digits and inner hyphens: a valid DNS label. */
const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Hosts the platform keeps for itself, so no school can take them. */
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin", "dashboard", "mail", "help", "status", "static", "cdn"]);

/** A school's subdomain: lower-cased, a DNS label, and not reserved. */
export const subdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(SUBDOMAIN_MIN_LENGTH)
  .max(SUBDOMAIN_MAX_LENGTH)
  .regex(SUBDOMAIN_PATTERN)
  .refine((subdomain) => !RESERVED_SUBDOMAINS.has(subdomain), { message: "Subdomain is reserved" });

/**
 * Suggests a subdomain from a school name: ASCII letters and digits joined by hyphens.
 * Names with no Latin letters or digits (e.g. Khmer) give an empty suggestion.
 *
 * @param name The school's name.
 * @returns A suggestion that may still be too short or reserved; validate it with `subdomainSchema`.
 * @example
 * suggestSubdomain("Café Angkor Academy!"); // "cafe-angkor-academy"
 */
export function suggestSubdomain(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, SUBDOMAIN_MAX_LENGTH)
    .replace(/^-+|-+$/g, "");
}

/** Create-school form input. */
export const createSchoolSchema = z.object({
  name: z.string().trim().min(1).max(SCHOOL_NAME_MAX_LENGTH),
  subdomain: subdomainSchema,
});

/** Parsed create-school input. */
export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
