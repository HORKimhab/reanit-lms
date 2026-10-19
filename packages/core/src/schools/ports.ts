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
