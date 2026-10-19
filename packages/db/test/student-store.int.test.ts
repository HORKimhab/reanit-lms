import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createDbClient, createStudentStore } from "../src";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const ALL = { search: null, limit: 50, offset: 0 };
let alphaId: string;
let betaId: string;

/**
 * Creates a user enrolled in the given courses, first enrollment at `joinedAt`.
 *
 * @param schoolId The school the courses belong to.
 * @param user The student.
 * @param user.email Unique email.
 * @param user.name Display name, if any.
 * @param enrollments Courses, with when they enrolled and whether they completed.
 * @returns The user's id.
 */
async function enrollStudent(
  schoolId: string,
  { email, name }: { email: string; name?: string },
  enrollments: { courseId: string; createdAt: Date; completedAt?: Date }[],
) {
  const user = await db.user.create({ data: { email, name } });
  for (const enrollment of enrollments) {
    await db.enrollment.create({ data: { schoolId, userId: user.id, source: "manual", ...enrollment } });
  }
  return user.id;
}

let sokhaId: string;
let vannaId: string;
let percentId: string;

beforeAll(async () => {
  alphaId = await openTestSchool(db, "students-alpha");
  betaId = await openTestSchool(db, "students-beta");
  const alpha = createCatalogStore(db, alphaId);
  const brand = (await alpha.createCourse({ title: "Brand", slug: "brand" })).id;
  const social = (await alpha.createCourse({ title: "Social", slug: "social" })).id;
  const betaCourse = (await createCatalogStore(db, betaId).createCourse({ title: "Beta", slug: "beta" })).id;

  sokhaId = await enrollStudent(alphaId, { email: "sokha@students.test", name: "Sokha Chan" }, [
    { courseId: brand, createdAt: new Date("2026-03-14"), completedAt: new Date("2026-04-01") },
    { courseId: social, createdAt: new Date("2026-05-01") },
  ]);
  vannaId = await enrollStudent(alphaId, { email: "vanna@students.test", name: "Vanna Lim" }, [
    { courseId: brand, createdAt: new Date("2026-08-02") },
  ]);
  percentId = await enrollStudent(alphaId, { email: "100%_off@students.test" }, [{ courseId: social, createdAt: new Date("2026-01-01") }]);
  await enrollStudent(betaId, { email: "beta-only@students.test", name: "Sokha Beta" }, [{ courseId: betaCourse, createdAt: new Date("2026-09-01") }]);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("student store", () => {
  it("lists the school's students newest first, with course and completion counts", async () => {
    expect(await createStudentStore(db, alphaId).searchStudents(ALL)).toEqual({
      total: 3,
      students: [
        { id: vannaId, name: "Vanna Lim", email: "vanna@students.test", joinedAt: new Date("2026-08-02"), courses: 1, completedCourses: 0 },
        { id: sokhaId, name: "Sokha Chan", email: "sokha@students.test", joinedAt: new Date("2026-03-14"), courses: 2, completedCourses: 1 },
        { id: percentId, name: null, email: "100%_off@students.test", joinedAt: new Date("2026-01-01"), courses: 1, completedCourses: 0 },
      ],
    });
  });

  it("finds students by name or email, ignoring case", async () => {
    const store = createStudentStore(db, alphaId);

    expect((await store.searchStudents({ ...ALL, search: "SOKHA" })).students.map((s) => s.id)).toEqual([sokhaId]);
    expect((await store.searchStudents({ ...ALL, search: "vanna@" })).students.map((s) => s.id)).toEqual([vannaId]);
  });

  it("matches % and _ literally", async () => {
    const store = createStudentStore(db, alphaId);

    expect((await store.searchStudents({ ...ALL, search: "100%_" })).students.map((s) => s.id)).toEqual([percentId]);
    expect((await store.searchStudents({ ...ALL, search: "%" })).students.map((s) => s.id)).toEqual([percentId]);
  });

  it("pages through the students and counts every match", async () => {
    const page = await createStudentStore(db, alphaId).searchStudents({ search: null, limit: 1, offset: 1 });

    expect(page.total).toBe(3);
    expect(page.students.map((s) => s.id)).toEqual([sokhaId]);
  });

  it("never lists another school's students", async () => {
    const beta = await createStudentStore(db, betaId).searchStudents({ ...ALL, search: "sokha" });

    expect(beta.students.map((s) => s.email)).toEqual(["beta-only@students.test"]);
    expect(beta.total).toBe(1);
  });

  it("returns nothing for a school without students", async () => {
    const emptyId = await openTestSchool(db, "students-empty");

    expect(await createStudentStore(db, emptyId).searchStudents(ALL)).toEqual({ students: [], total: 0 });
  });
});
