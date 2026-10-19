// In-memory fake of the schools port, for unit tests of the school service.
import type { MembershipRole, SchoolChanges, SchoolRecord, SchoolStore, StudentStore, StudentSummary } from "../schools";

/** In-memory `SchoolStore` whose rows tests can inspect. */
export class FakeSchoolStore implements SchoolStore {
  readonly schools: SchoolRecord[] = [];
  /** Owner user id by school id. */
  readonly owners = new Map<string, string>();
  /** Display names by user id; users missing here have no name. */
  readonly userNames = new Map<string, string>();
  /** Memberships in creation order. */
  readonly memberships: { schoolId: string; userId: string; role: MembershipRole }[] = [];

  /**
   * Finds a school by exact subdomain.
   *
   * @param subdomain Normalized subdomain.
   * @returns The school or null.
   */
  async findSchoolBySubdomain(subdomain: string) {
    return this.schools.find((school) => school.subdomain === subdomain) ?? null;
  }

  /**
   * Stores a school with a sequential id and records its owner.
   *
   * @param input New school.
   * @param input.name School name.
   * @param input.subdomain Normalized subdomain.
   * @param input.ownerId Owner's user id.
   * @returns The school.
   */
  async createSchoolWithOwner({ name, subdomain, ownerId }: { name: string; subdomain: string; ownerId: string }) {
    const school = { id: `school-${this.schools.length + 1}`, name, subdomain, brandColor: null, logoKey: null };
    this.schools.push(school);
    this.owners.set(school.id, ownerId);
    this.memberships.push({ schoolId: school.id, userId: ownerId, role: "owner" });
    return school;
  }

  /**
   * Looks up the name of a school's owner.
   *
   * @param schoolId The school's id.
   * @returns The owner's name, or null when they have none.
   */
  async findOwnerName(schoolId: string) {
    const ownerId = this.owners.get(schoolId);
    return (ownerId && this.userNames.get(ownerId)) ?? null;
  }

  /**
   * Lists the user's schools in membership order.
   *
   * @param userId The user's id.
   * @returns Each school with the user's role.
   */
  async findSchoolsForUser(userId: string) {
    return this.memberships
      .filter((membership) => membership.userId === userId)
      .map(({ schoolId, role }) => ({ school: this.schools.find((school) => school.id === schoolId)!, role })); // memberships only reference stored schools
  }

  /**
   * Applies settings to a stored school.
   *
   * @param schoolId The school's id.
   * @param changes The new values; a missing `logoKey` keeps the logo.
   * @returns The updated school.
   * @throws {Error} When no school has the id.
   */
  async updateSchool(schoolId: string, changes: SchoolChanges) {
    const index = this.schools.findIndex((school) => school.id === schoolId);
    if (index === -1) throw new Error(`No school ${schoolId}`);
    const updated = { ...this.schools[index]!, ...changes }; // findIndex found it
    this.schools[index] = updated;
    return updated;
  }
}

/** In-memory `StudentStore` that records the last query and answers with `students`. */
export class FakeStudentStore implements StudentStore {
  students: StudentSummary[] = [];
  total = 0;
  /** The query `searchStudents` was last called with. */
  lastQuery: { search: string | null; limit: number; offset: number } | null = null;

  /**
   * Records the query and returns the programmed page.
   *
   * @param query The search, limit and offset.
   * @param query.search Text to find, or null.
   * @param query.limit Page size.
   * @param query.offset Students to skip.
   * @returns `students` and `total`.
   */
  async searchStudents(query: { search: string | null; limit: number; offset: number }) {
    this.lastQuery = query;
    return { students: this.students, total: this.total };
  }
}
