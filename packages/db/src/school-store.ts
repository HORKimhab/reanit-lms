import type { DbClient } from "./client";

const SCHOOL_FIELDS = { id: true, name: true, subdomain: true } as const;

/**
 * Persistence for creating and resolving schools. Runs before any tenant is known
 * (sign-up wizard, subdomain lookup), so it uses the unscoped client; it satisfies
 * `SchoolStore` from `@reanit/core/schools`.
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
  };
}
