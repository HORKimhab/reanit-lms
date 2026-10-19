import { beforeAll, describe, expect, it } from "vitest";

import { buyCourse, openSchool, signUp, uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp();
let alpha: Awaited<ReturnType<typeof openSchoolWithCourse>>;
let beta: Awaited<ReturnType<typeof openSchoolWithCourse>>;
let buyerEmail: string;

/**
 * Opens a school with one published, priced course.
 *
 * @param name Unique name for the school.
 * @returns The owner's agent, the school and the course's slug.
 */
async function openSchoolWithCourse(name: string) {
  const opened = await openSchool(e2e().app, name);
  const { course } = (await opened.agent.post("/courses").send({ title: "Sold Course" }).expect(201)).body;
  await opened.agent.patch(`/courses/${course.id}`).send({ status: "published" }).expect(200);
  await opened.agent.put(`/courses/${course.id}/price`).send({ amount: 4900, currency: "USD" }).expect(200);
  return { ...opened, courseSlug: course.slug as string };
}

beforeAll(async () => {
  alpha = await openSchoolWithCourse(uniqueName("students-alpha"));
  beta = await openSchoolWithCourse(uniqueName("students-beta"));
  const buyer = await signUp(e2e().app, uniqueName("students-buyer"));
  buyerEmail = buyer.email;
  await buyCourse(e2e(), buyer.agent, alpha.school.subdomain, alpha.courseSlug);
});

describe("students", () => {
  it("lists a buyer as the school's student and finds them by email", async () => {
    const all = (await alpha.agent.get("/students").expect(200)).body;
    expect(all).toMatchObject({ total: 1, page: 1, students: [{ email: buyerEmail, courses: 1, completedCourses: 0 }] });

    const found = (await alpha.agent.get("/students").query({ q: buyerEmail.toUpperCase() }).expect(200)).body;
    expect(found.students.map((student: { email: string }) => student.email)).toEqual([buyerEmail]);
    expect((await alpha.agent.get("/students").query({ q: "nobody-matches" }).expect(200)).body).toMatchObject({ total: 0, students: [] });
  });

  it("never shows another school's students", async () => {
    expect((await beta.agent.get("/students").expect(200)).body).toMatchObject({ total: 0, students: [] });
  });

  it("answers 403 to a user who runs no school", async () => {
    const { agent } = await signUp(e2e().app, uniqueName("students-none"));

    await agent.get("/students").expect(403);
  });
});
