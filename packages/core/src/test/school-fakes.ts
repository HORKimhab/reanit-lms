// In-memory fakes of the schools ports, for unit tests of the school and domain services.
import type {
  DnsLookup,
  DomainCertificates,
  DomainChanges,
  DomainRecord,
  DomainStore,
  DomainTlsStatus,
  MembershipRole,
  SchoolChanges,
  SchoolRecord,
  SchoolStore,
  StudentStore,
  StudentSummary,
} from "../schools";

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

/** In-memory `DomainStore`: domains by school id, and each school's subdomain for lookups by hostname. */
export class FakeDomainStore implements DomainStore {
  readonly domains = new Map<string, DomainRecord>();
  /** Subdomain by school id. */
  readonly subdomains = new Map<string, string>();

  /**
   * Finds the school's domain.
   *
   * @param schoolId The school's id.
   * @returns The domain or null.
   */
  async findDomain(schoolId: string) {
    return this.domains.get(schoolId) ?? null;
  }

  /**
   * Finds the subdomain of the school that verified the hostname.
   *
   * @param hostname The hostname.
   * @returns The subdomain, or null when no school verified it.
   */
  async findVerifiedSubdomain(hostname: string) {
    const owner = [...this.domains].find(([, domain]) => domain.hostname === hostname && domain.verifiedAt);
    return owner ? (this.subdomains.get(owner[0]) ?? null) : null;
  }

  /**
   * Stores an unverified domain for the school.
   *
   * @param schoolId The school's id.
   * @param domain The hostname and its verification token.
   * @param domain.hostname The hostname.
   * @param domain.verificationToken The token.
   * @returns The domain.
   */
  async createDomain(schoolId: string, { hostname, verificationToken }: { hostname: string; verificationToken: string }) {
    const domain = { hostname, verificationToken, verifiedAt: null, certificateId: null, tlsStatus: null };
    this.domains.set(schoolId, domain);
    return domain;
  }

  /**
   * Applies changes to the school's domain.
   *
   * @param schoolId The school's id.
   * @param changes The new values.
   * @returns The updated domain.
   * @throws {Error} When the school has no domain.
   */
  async updateDomain(schoolId: string, changes: DomainChanges) {
    const current = this.domains.get(schoolId);
    if (!current) throw new Error(`No domain for ${schoolId}`);
    const updated = { ...current, ...changes };
    this.domains.set(schoolId, updated);
    return updated;
  }

  /**
   * Deletes the school's domain.
   *
   * @param schoolId The school's id.
   */
  async deleteDomain(schoolId: string) {
    this.domains.delete(schoolId);
  }
}

/** `DnsLookup` answering from a map of TXT records by name. */
export class FakeDnsLookup implements DnsLookup {
  readonly txt = new Map<string, string[]>();

  /**
   * Returns the TXT records stored for the name.
   *
   * @param name Fully qualified name.
   * @returns Its records, or none.
   */
  async txtRecords(name: string) {
    return this.txt.get(name) ?? [];
  }
}

/** `DomainCertificates` that records requests and removals, with certificate statuses tests can set. */
export class FakeDomainCertificates implements DomainCertificates {
  /** Status by certificate id. */
  readonly statuses = new Map<string, DomainTlsStatus>();
  readonly removed: string[] = [];

  /**
   * Requests a pending certificate whose id is `cert-<hostname>`, or returns the existing one.
   *
   * @param hostname The hostname.
   * @returns The certificate's id and status.
   */
  async request(hostname: string) {
    const id = `cert-${hostname}`;
    if (!this.statuses.has(id)) this.statuses.set(id, "pending");
    return { id, status: this.statuses.get(id)! }; // set just above
  }

  /**
   * Reads a certificate's status.
   *
   * @param id The certificate's id.
   * @returns Its status.
   * @throws {Error} When no certificate has the id.
   */
  async status(id: string) {
    const status = this.statuses.get(id);
    if (!status) throw new Error(`No certificate ${id}`);
    return status;
  }

  /**
   * Removes a certificate.
   *
   * @param id The certificate's id.
   */
  async remove(id: string) {
    this.statuses.delete(id);
    this.removed.push(id);
  }
}
