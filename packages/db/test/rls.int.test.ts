import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { ZodError } from "zod";
import { createDbClient, forSchool, type DbClient } from "../src";

const db: DbClient = createDbClient(inject("databaseUrl"));

/**
 * Creates a school with one draft course, bypassing RLS through the owner connection.
 *
 * @param subdomain Unique subdomain for the school.
 * @returns The new school's and course's ids.
 */
async function seedSchoolWithCourse(subdomain: string) {
  const school = await db.school.create({
    data: { name: subdomain, subdomain, courses: { create: { title: `${subdomain} course`, slug: "intro" } } },
    include: { courses: true },
  });
  return { schoolId: school.id, courseId: school.courses[0]!.id }; // created just above
}

let alpha: Awaited<ReturnType<typeof seedSchoolWithCourse>>;
let beta: Awaited<ReturnType<typeof seedSchoolWithCourse>>;

beforeAll(async () => {
  alpha = await seedSchoolWithCourse("alpha");
  beta = await seedSchoolWithCourse("beta");
});

afterAll(async () => {
  await db.$disconnect();
});

describe("tenant client RLS isolation", () => {
  it("returns only its own school's courses when several schools have courses", async () => {
    const courses = await forSchool(db, alpha.schoolId).course.findMany();

    expect(courses.map((course) => course.id)).toEqual([alpha.courseId]);
  });

  it("returns null when reading another school's course by id", async () => {
    const course = await forSchool(db, alpha.schoolId).course.findUnique({ where: { id: beta.courseId } });

    expect(course).toBeNull();
  });

  it("returns only its own school when listing schools", async () => {
    const schools = await forSchool(db, alpha.schoolId).school.findMany();

    expect(schools.map((school) => school.id)).toEqual([alpha.schoolId]);
  });

  it("updates nothing when targeting another school's course", async () => {
    const { count } = await forSchool(db, alpha.schoolId).course.updateMany({
      where: { id: beta.courseId },
      data: { title: "hijacked" },
    });

    expect(count).toBe(0);
    expect((await db.course.findUniqueOrThrow({ where: { id: beta.courseId } })).title).toBe("beta course");
  });

  it("deletes nothing when targeting another school's course", async () => {
    const { count } = await forSchool(db, alpha.schoolId).course.deleteMany({ where: { id: beta.courseId } });

    expect(count).toBe(0);
    expect(await db.course.findUnique({ where: { id: beta.courseId } })).not.toBeNull();
  });

  it("rejects creating a row that belongs to another school", async () => {
    const create = forSchool(db, alpha.schoolId).course.create({
      data: { schoolId: beta.schoolId, title: "planted", slug: "planted" },
    });

    await expect(create).rejects.toThrow();
    expect(await db.course.findFirst({ where: { slug: "planted" } })).toBeNull();
  });

  it("creates a row for its own school", async () => {
    const course = await forSchool(db, alpha.schoolId).course.create({
      data: { schoolId: alpha.schoolId, title: "Second", slug: "second" },
    });

    expect(course.schoolId).toBe(alpha.schoolId);
    await db.course.delete({ where: { id: course.id } });
  });

  it("sees no tenant rows when the app role has no school set", async () => {
    const [, rows] = await db.$transaction([
      db.$executeRaw`SET LOCAL ROLE reanit_app`,
      db.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM courses`,
    ]);

    expect(rows[0]?.count).toBe(0n);
  });

  it("throws when the school id is not a UUID", () => {
    expect(() => forSchool(db, "alpha")).toThrow(ZodError);
  });

  it("denies the tenant client any access to sessions and magic links", async () => {
    const tenant = forSchool(db, alpha.schoolId);

    await expect(tenant.session.findMany()).rejects.toThrow(/permission denied/);
    await expect(tenant.magicLinkToken.findMany()).rejects.toThrow(/permission denied/);
  });

  it("has RLS enabled on every table with a school_id column", async () => {
    const unprotected = await db.$queryRaw<{ table_name: string }[]>`
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'school_id' AND NOT a.attisdropped
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relkind = 'r' AND NOT c.relrowsecurity`;

    expect(unprotected).toEqual([]);
  });
});
