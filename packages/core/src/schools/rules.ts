import { z } from "zod";

import { pageSchema } from "../shared/paging";
import { slugify } from "../shared/slug";

/** DNS label limits; 3 keeps out ambiguous one- and two-letter names. */
const SUBDOMAIN_MIN_LENGTH = 3;
const SUBDOMAIN_MAX_LENGTH = 63;
/** Longest school name accepted. */
export const SCHOOL_NAME_MAX_LENGTH = 100;

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
  return slugify(name, SUBDOMAIN_MAX_LENGTH);
}

/** Create-school form input. */
export const createSchoolSchema = z.object({
  name: z.string().trim().min(1).max(SCHOOL_NAME_MAX_LENGTH),
  subdomain: subdomainSchema,
});

/** Parsed create-school input. */
export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;

/** Brand color of a school whose owner has not picked one: its site and its certificates use it. */
export const DEFAULT_BRAND_COLOR = "#008b52";

/** A brand color as the settings form sends it: `#rrggbb`, stored lower-cased. */
const BRAND_COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const MIB = 1024 * 1024;
const STORAGE_KEY_MAX_LENGTH = 512;
const STUDENT_SEARCH_MAX_LENGTH = 100;

/**
 * Images a school's logo and payment QR may be, with the file extension stored, and how big they may
 * be. SVG is left out because it can carry scripts.
 */
export const SCHOOL_IMAGE_RULES = {
  contentTypes: { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" },
  maxBytes: MIB,
} as const;

/** A school image's storage key: leave it out to keep the image, send null to remove it. */
const imageKeySchema = z.string().min(1).max(STORAGE_KEY_MAX_LENGTH).nullable().optional();

/** Settings form input; leave out `logoKey` or `paymentQrKey` to keep that image, send null to remove it. */
export const schoolSettingsSchema = z.object({
  name: createSchoolSchema.shape.name,
  brandColor: z.string().trim().toLowerCase().regex(BRAND_COLOR_PATTERN).nullable(),
  logoKey: imageKeySchema,
  /** The school's own payment QR image, which students scan to pay subscriptions and plans offline. */
  paymentQrKey: imageKeySchema,
});

/** Parsed settings input. */
export type SchoolSettingsInput = z.infer<typeof schoolSettingsSchema>;

/** Students list query: an optional name or email search and a 1-based page. */
export const studentSearchSchema = z.object({
  q: z.string().trim().max(STUDENT_SEARCH_MAX_LENGTH).optional(),
  page: pageSchema,
});

/** Parsed students list query. */
export type StudentSearchInput = z.infer<typeof studentSearchSchema>;

/** A school's own images: its logo, and the payment QR students scan to pay offline. */
export type SchoolImage = "logo" | "payment-qr";

/**
 * Where a school's images of one kind live in the bucket, so a key from another school, or another
 * kind of image, can never be saved.
 *
 * @param schoolId The school's id.
 * @param image Which image.
 * @returns The key prefix, ending in a slash.
 * @example
 * schoolImagePrefix(school.id, "logo"); // "schools/<school>/logo/"
 */
export function schoolImagePrefix(schoolId: string, image: SchoolImage): string {
  return `schools/${schoolId}/${image}/`;
}
