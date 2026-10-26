/** A school as the schools module returns it. */
export interface School {
  id: string;
  name: string;
  subdomain: string;
  /** `#rrggbb` used as the school site's brand color; null for the platform default. */
  brandColor: string | null;
  /** Signed URL of the logo, valid for `LOGO_URL_TTL_SECONDS`; null when the school has none. */
  logoUrl: string | null;
}

/** A school as stored: the logo is an object-storage key, signed into a URL on the way out. */
export type SchoolRecord = Omit<School, "logoUrl"> & { logoKey: string | null };

/** What a settings save writes; a missing `logoKey` keeps the current logo, null removes it. */
export interface SchoolChanges {
  name: string;
  brandColor: string | null;
  logoKey?: string | null;
}

/** A member's role in a school. */
export type MembershipRole = "owner" | "admin" | "instructor" | "student";

/** Persistence for schools. `@reanit/db` implements it with `createSchoolStore`. */
export interface SchoolStore {
  findSchoolBySubdomain(subdomain: string): Promise<SchoolRecord | null>;
  /** The user's schools with their role in each, oldest membership first. */
  findSchoolsForUser(userId: string): Promise<{ school: SchoolRecord; role: MembershipRole }[]>;
  /** The name of the school's owner; null when the owner has not given one (magic-link accounts). */
  findOwnerName(schoolId: string): Promise<string | null>;
  /** Creates the school and makes `ownerId` its owner, atomically. */
  createSchoolWithOwner(school: { name: string; subdomain: string; ownerId: string }): Promise<SchoolRecord>;
  /** Saves the school's settings through the tenant client. */
  updateSchool(schoolId: string, changes: SchoolChanges): Promise<SchoolRecord>;
}

/** A student of the school, as the dashboard's students list shows them. */
export interface StudentSummary {
  id: string;
  /** Null for accounts that only sign in by magic link. */
  name: string | null;
  email: string;
  /** When they first enrolled in one of the school's courses. */
  joinedAt: Date;
  /** Courses they are enrolled in. */
  courses: number;
  /** Of those, courses they completed. */
  completedCourses: number;
}

/** One school's students: users enrolled in at least one of its courses. `@reanit/db` implements it with `createStudentStore`. */
export interface StudentStore {
  /** One page of students matching `search` in name or email (all when null), newest first, with the number that match. */
  searchStudents(query: { search: string | null; limit: number; offset: number }): Promise<{ students: StudentSummary[]; total: number }>;
}

/** Where a custom domain's certificate stands at the edge. */
export type DomainTlsStatus = "pending" | "active" | "failed";

/** A school's custom domain as stored. */
export interface DomainRecord {
  hostname: string;
  /** Secret the owner publishes in a TXT record to prove they control the hostname. */
  verificationToken: string;
  /** When the TXT record was found; null until then. Only verified domains are served. */
  verifiedAt: Date | null;
  /** The certificate provider's id for the hostname; null until verification requests one. */
  certificateId: string | null;
  /** Null until verification requests a certificate. */
  tlsStatus: DomainTlsStatus | null;
}

/** What verifying or checking a domain writes. */
export type DomainChanges = Partial<Pick<DomainRecord, "verifiedAt" | "certificateId" | "tlsStatus">>;

/** Persistence for custom domains, one per school. `@reanit/db` implements it with `createDomainStore`. */
export interface DomainStore {
  /** The school's domain through the tenant client; null when it has none. */
  findDomain(schoolId: string): Promise<DomainRecord | null>;
  /** The subdomain of the school whose verified domain `hostname` is, across schools; null when there is none. */
  findVerifiedSubdomain(hostname: string): Promise<string | null>;
  createDomain(schoolId: string, domain: { hostname: string; verificationToken: string }): Promise<DomainRecord>;
  updateDomain(schoolId: string, changes: DomainChanges): Promise<DomainRecord>;
  deleteDomain(schoolId: string): Promise<void>;
}

/** Reads public DNS. The API implements it with `node:dns`. */
export interface DnsLookup {
  /** The TXT records at `name`, each record's strings joined; empty when the name has none or does not exist. */
  txtRecords(name: string): Promise<string[]>;
}

/** Issues and serves certificates for custom domains at the edge. The API implements it with Cloudflare for SaaS. */
export interface DomainCertificates {
  /** Requests a certificate for the hostname, or returns the one already requested, so repeating it is safe. */
  request(hostname: string): Promise<{ id: string; status: DomainTlsStatus }>;
  status(id: string): Promise<DomainTlsStatus>;
  /** Stops serving the hostname; resolves when it is already gone. */
  remove(id: string): Promise<void>;
}
