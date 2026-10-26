import type { DbClient } from "./client";
import type { Prisma } from "./generated/prisma/client";
import { forSchool } from "./tenant";

/** A domain's columns, as `DomainRecord` in `@reanit/core/schools` has them. */
const DOMAIN_FIELDS = {
  hostname: true,
  verificationToken: true,
  verifiedAt: true,
  certificateId: true,
  tlsStatus: true,
} satisfies Prisma.DomainSelect;

/**
 * Persistence for schools' custom domains. A school's own domain is read and written through its
 * tenant client; finding which school verified a hostname runs before any tenant is known, so it
 * uses the unscoped client. It satisfies `DomainStore` from `@reanit/core/schools`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @returns The store operations.
 * @example
 * const domains = createDomainService({ store: createDomainStore(db), dns, clock, newToken, rootDomain, edge });
 */
export function createDomainStore(db: DbClient) {
  return {
    /**
     * Finds the school's custom domain.
     *
     * @param schoolId The school's id.
     * @returns The domain, or null when it has none.
     * @throws {z.ZodError} When `schoolId` is not a UUID.
     */
    findDomain(schoolId: string) {
      return forSchool(db, schoolId).domain.findUnique({ where: { schoolId }, select: DOMAIN_FIELDS });
    },

    /**
     * Finds the school whose verified domain the hostname is, across schools.
     *
     * @param hostname A normalized hostname.
     * @returns That school's subdomain, or null when no school verified the hostname.
     */
    async findVerifiedSubdomain(hostname: string) {
      const domain = await db.domain.findFirst({
        where: { hostname, verifiedAt: { not: null } },
        select: { school: { select: { subdomain: true } } },
      });
      return domain?.school.subdomain ?? null;
    },

    /**
     * Stores the school's new, unverified domain.
     *
     * @param schoolId The school's id.
     * @param domain The hostname and its verification token.
     * @param domain.hostname A normalized hostname.
     * @param domain.verificationToken The token its TXT record must hold.
     * @returns The domain.
     * @throws {z.ZodError} When `schoolId` is not a UUID.
     * @throws {Error} When the school already has a domain (unique constraint).
     */
    createDomain(schoolId: string, { hostname, verificationToken }: { hostname: string; verificationToken: string }) {
      return forSchool(db, schoolId).domain.create({ data: { schoolId, hostname, verificationToken }, select: DOMAIN_FIELDS });
    },

    /**
     * Saves the school's domain's verification and certificate progress.
     *
     * @param schoolId The school's id.
     * @param changes When it was verified, its certificate's id and status.
     * @returns The updated domain.
     * @throws {z.ZodError} When `schoolId` is not a UUID.
     * @throws {Error} When the school has no domain.
     */
    updateDomain(schoolId: string, changes: Pick<Prisma.DomainUpdateInput, "verifiedAt" | "certificateId" | "tlsStatus">) {
      return forSchool(db, schoolId).domain.update({ where: { schoolId }, data: changes, select: DOMAIN_FIELDS });
    },

    /**
     * Deletes the school's domain, if it has one.
     *
     * @param schoolId The school's id.
     * @throws {z.ZodError} When `schoolId` is not a UUID.
     */
    async deleteDomain(schoolId: string) {
      await forSchool(db, schoolId).domain.deleteMany({ where: { schoolId } });
    },
  };
}
