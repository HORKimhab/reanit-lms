// Opens schools for integration tests, through the real school store.
import type { DbClient } from "../client";
import { createSchoolStore } from "../school-store";

/**
 * Creates an owner and a school they own.
 *
 * @param db Unscoped client on the test database.
 * @param subdomain Unique subdomain, also used for the owner's email.
 * @returns The school's id.
 */
export async function openTestSchool(db: DbClient, subdomain: string): Promise<string> {
  const owner = await db.user.create({ data: { email: `${subdomain}@example.com` } });
  return (await createSchoolStore(db).createSchoolWithOwner({ name: subdomain, subdomain, ownerId: owner.id })).id;
}

/**
 * Creates a student enrolled in a course without an order, as a manual enrollment.
 *
 * @param db Unscoped client on the test database.
 * @param course The course.
 * @param course.schoolId Its school.
 * @param course.courseId Its id.
 * @param email The student's unique email.
 * @returns The student's and the enrollment's ids.
 */
export async function enrollTestStudent(db: DbClient, { schoolId, courseId }: { schoolId: string; courseId: string }, email: string) {
  const studentId = (await db.user.create({ data: { email } })).id;
  const enrollmentId = (await db.enrollment.create({ data: { schoolId, userId: studentId, courseId, source: "manual" } })).id;
  return { studentId, enrollmentId };
}
