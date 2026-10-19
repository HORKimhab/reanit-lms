/** A school as the schools module returns it. */
export interface School {
  id: string;
  name: string;
  subdomain: string;
}

/** A member's role in a school. */
export type MembershipRole = "owner" | "admin" | "instructor" | "student";

/** Persistence for schools. `@reanit/db` implements it with `createSchoolStore`. */
export interface SchoolStore {
  findSchoolBySubdomain(subdomain: string): Promise<School | null>;
  /** The user's schools with their role in each, oldest membership first. */
  findSchoolsForUser(userId: string): Promise<{ school: School; role: MembershipRole }[]>;
  /** Creates the school and makes `ownerId` its owner, atomically. */
  createSchoolWithOwner(school: { name: string; subdomain: string; ownerId: string }): Promise<School>;
}
