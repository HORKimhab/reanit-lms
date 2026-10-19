// In-memory fake of the schools port, for unit tests of the school service.
import type { MembershipRole, School, SchoolStore } from "../schools";

/** In-memory `SchoolStore` whose rows tests can inspect. */
export class FakeSchoolStore implements SchoolStore {
  readonly schools: School[] = [];
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
    const school = { id: `school-${this.schools.length + 1}`, name, subdomain };
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
}
