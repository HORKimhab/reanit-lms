import { NotSchoolStaffError, SubdomainTakenError } from "./errors";
import type { MembershipRole, School, SchoolStore } from "./ports";
import type { CreateSchoolInput } from "./rules";

/** Roles that may run a school's dashboard and edit its catalog. */
const STAFF_ROLES: ReadonlySet<MembershipRole> = new Set(["owner", "admin", "instructor"]);

/**
 * Builds the school use cases over an injected store.
 *
 * @param dependencies Store for schools.
 * @param dependencies.store Persistence for schools and their owners.
 * @returns School operations.
 * @example
 * const schools = createSchoolService({ store: createSchoolStore(db) });
 */
export function createSchoolService({ store }: { store: SchoolStore }) {
  return {
    /**
     * Opens a new school owned by the signed-in creator.
     *
     * @param input Parsed create-school form.
     * @param ownerId The creator's user id.
     * @returns The new school.
     * @throws {SubdomainTakenError} When another school has the subdomain.
     */
    async createSchool(input: CreateSchoolInput, ownerId: string): Promise<School> {
      if (await store.findSchoolBySubdomain(input.subdomain)) throw new SubdomainTakenError();
      return store.createSchoolWithOwner({ ...input, ownerId });
    },

    /**
     * Picks the school a creator's dashboard works on: their first school as staff.
     * M1 creators run one school; choosing between several comes later.
     *
     * @param userId The signed-in user's id.
     * @returns The school and the user's role in it.
     * @throws {NotSchoolStaffError} When the user is staff in no school.
     */
    async getStaffSchool(userId: string): Promise<{ school: School; role: MembershipRole }> {
      const membership = (await store.findSchoolsForUser(userId)).find(({ role }) => STAFF_ROLES.has(role));
      if (!membership) throw new NotSchoolStaffError();
      return membership;
    },
  };
}

/** The school use cases. */
export type SchoolService = ReturnType<typeof createSchoolService>;
