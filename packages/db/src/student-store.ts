import type { DbClient } from "./client";
import { inSchoolTransaction } from "./tenant";

/** A student row as the search query returns it. */
type StudentRow = { id: string; name: string | null; email: string; joinedAt: Date; courses: number; completedCourses: number };

/** Characters with a meaning in a LIKE pattern, escaped so a search for them matches them literally. */
const LIKE_SPECIAL = /[\\%_]/g;

/**
 * One school's students: users with at least one enrollment in its courses. Queries run as the
 * school, so RLS on enrollments hides every other school's students; it satisfies `StudentStore`
 * from `@reanit/core/schools`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school whose students these are.
 * @returns The store operations.
 * @example
 * const students = createStudentService({ store: createStudentStore(db, school.id) });
 */
export function createStudentStore(db: DbClient, schoolId: string) {
  return {
    /**
     * Finds one page of students whose name or email contains the search, newest first by
     * first enrollment, with each one's course and completion counts.
     *
     * @param query The search, page size and offset.
     * @param query.search Text to find, case-insensitively; null lists everyone.
     * @param query.limit Students per page.
     * @param query.offset Students to skip.
     * @returns The page and how many students match in total.
     * @throws {z.ZodError} When `schoolId` is not a UUID.
     */
    searchStudents({ search, limit, offset }: { search: string | null; limit: number; offset: number }) {
      const pattern = search === null ? null : `%${search.replace(LIKE_SPECIAL, "\\$&")}%`;
      return inSchoolTransaction(db, schoolId, async (tx) => {
        const students = await tx.$queryRaw<StudentRow[]>`
          SELECT u.id, u.name, u.email, min(e.created_at) AS "joinedAt",
                 count(*)::int AS courses, count(e.completed_at)::int AS "completedCourses"
          FROM enrollments e
          JOIN users u ON u.id = e.user_id
          WHERE ${pattern}::text IS NULL OR u.name ILIKE ${pattern} OR u.email ILIKE ${pattern}
          GROUP BY u.id
          ORDER BY "joinedAt" DESC, u.id
          LIMIT ${limit} OFFSET ${offset}`;
        const [{ total }] = await tx.$queryRaw<[{ total: number }]>`
          SELECT count(DISTINCT u.id)::int AS total
          FROM enrollments e
          JOIN users u ON u.id = e.user_id
          WHERE ${pattern}::text IS NULL OR u.name ILIKE ${pattern} OR u.email ILIKE ${pattern}`;
        return { students, total };
      });
    },
  };
}
