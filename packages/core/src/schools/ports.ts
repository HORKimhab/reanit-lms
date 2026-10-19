/** A school as the schools module returns it. */
export interface School {
  id: string;
  name: string;
  subdomain: string;
}

/** Persistence for schools. `@reanit/db` implements it with `createSchoolStore`. */
export interface SchoolStore {
  findSchoolBySubdomain(subdomain: string): Promise<School | null>;
  /** Creates the school and makes `ownerId` its owner, atomically. */
  createSchoolWithOwner(school: { name: string; subdomain: string; ownerId: string }): Promise<School>;
}
