// In-memory fake of the schools port, for unit tests of the school service.
import type { School, SchoolStore } from "../schools";

/** In-memory `SchoolStore` whose rows tests can inspect. */
export class FakeSchoolStore implements SchoolStore {
  readonly schools: School[] = [];
  /** Owner user id by school id. */
  readonly owners = new Map<string, string>();

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
    return school;
  }
}
