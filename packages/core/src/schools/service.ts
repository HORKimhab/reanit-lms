import { SubdomainTakenError } from "./errors";
import type { School, SchoolStore } from "./ports";
import type { CreateSchoolInput } from "./rules";

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
  };
}

/** The school use cases. */
export type SchoolService = ReturnType<typeof createSchoolService>;
