import type { DbClient } from "./client";
import { forSchool } from "./tenant";

const SCHOOL_FIELDS = { id: true, name: true, subdomain: true, brandColor: true, logoKey: true, paymentQrKey: true } as const;

/**
 * Persistence for creating and resolving schools. Runs before any tenant is known
 * (sign-up wizard, subdomain lookup), so it uses the unscoped client, except for settings
 * saves, which go through the tenant client; it satisfies `SchoolStore` from `@reanit/core/schools`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @returns The store operations.
 * @example
 * const schools = createSchoolService({ store: createSchoolStore(db) });
 */
export function createSchoolStore(db: DbClient) {
  return {
    /**
     * Finds a school by subdomain.
     *
     * @param subdomain Normalized subdomain.
     * @returns The school or null.
     */
    findSchoolBySubdomain(subdomain: string) {
      return db.school.findUnique({ where: { subdomain }, select: SCHOOL_FIELDS });
    },

    /**
     * Lists a user's schools across tenants, with their role in each; this is how a
     * signed-in creator's school is found before any tenant is set.
     *
     * @param userId The user's id.
     * @returns Schools and roles, oldest membership first.
     */
    findSchoolsForUser(userId: string) {
      return db.membership.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { role: true, school: { select: SCHOOL_FIELDS } },
      });
    },

    /**
     * Looks up the display name of a school's owner, for its public pages.
     *
     * @param schoolId The school's id.
     * @returns The owner's name, or null when they gave none.
     */
    async findOwnerName(schoolId: string) {
      const owner = await db.membership.findFirst({
        where: { schoolId, role: "owner" },
        orderBy: { createdAt: "asc" },
        select: { user: { select: { name: true } } },
      });
      return owner?.user.name ?? null;
    },

    /**
     * Creates a school and its owner membership in one statement, so neither exists without the other.
     *
     * @param school New school.
     * @param school.name School name.
     * @param school.subdomain Normalized subdomain.
     * @param school.ownerId Creator's user id.
     * @returns The school.
     * @throws {Error} When the subdomain is taken (unique constraint) or the owner does not exist.
     */
    createSchoolWithOwner({ name, subdomain, ownerId }: { name: string; subdomain: string; ownerId: string }) {
      return db.school.create({
        data: { name, subdomain, memberships: { create: { userId: ownerId, role: "owner" } } },
        select: SCHOOL_FIELDS,
      });
    },

    /**
     * Saves a school's settings as that school, so RLS rejects writes to any other.
     *
     * @param schoolId The school's id.
     * @param changes New name, brand color and, when given, image keys (null removes the image).
     * @param changes.name School name.
     * @param changes.brandColor `#rrggbb`, or null for the platform default.
     * @param changes.logoKey Logo's storage key; left out to keep the current logo.
     * @param changes.paymentQrKey Payment QR image's storage key; left out to keep the current one.
     * @returns The updated school.
     * @throws {z.ZodError} When `schoolId` is not a UUID.
     * @throws {Error} When the school does not exist.
     */
    updateSchool(
      schoolId: string,
      { name, brandColor, logoKey, paymentQrKey }: { name: string; brandColor: string | null; logoKey?: string | null; paymentQrKey?: string | null },
    ) {
      return forSchool(db, schoolId).school.update({
        where: { id: schoolId },
        data: { name, brandColor, ...(logoKey !== undefined && { logoKey }), ...(paymentQrKey !== undefined && { paymentQrKey }) },
        select: SCHOOL_FIELDS,
      });
    },
  };
}
