import { CourseNotFoundError, type Course } from "@reanit/core/catalog";
import { SchoolNotFoundError } from "@reanit/core/schools";
import { describe, expect, it } from "vitest";

import { type FakeClients, useTestApp } from "../test/app";
import { TEST_SCHOOL } from "../test/session";

const COURSE: Course = {
  id: "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a99",
  title: "Intro to Design",
  slug: "intro-to-design",
  description: "Learn the basics.",
  status: "published",
};
const BASE_URL = `/schools/by-subdomain/${TEST_SCHOOL.subdomain}/courses`;

/**
 * Makes every subdomain resolve to `TEST_SCHOOL`.
 *
 * @param clients Fakes from `createFakeClients`.
 */
function resolveTestSchool(clients: FakeClients) {
  clients.schools.getSchoolBySubdomain.mockResolvedValue(TEST_SCHOOL);
}

const testApp = useTestApp(resolveTestSchool);

describe("public catalog", () => {
  it("lists the school's published courses to signed-out callers", async () => {
    testApp.clients.catalog.listPublishedCourses.mockResolvedValue([COURSE]);

    const response = await testApp.app.inject({ method: "GET", url: BASE_URL });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ courses: [COURSE] });
    expect(testApp.clients.schools.getSchoolBySubdomain).toHaveBeenCalledWith(TEST_SCHOOL.subdomain);
    expect(testApp.clients.catalogFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
  });

  it("loads a published course with its outline", async () => {
    testApp.clients.catalog.getPublishedCourse.mockResolvedValue({ ...COURSE, sections: [] });

    const response = await testApp.app.inject({ method: "GET", url: `${BASE_URL}/${COURSE.slug}` });

    expect(response.json()).toEqual({ course: { ...COURSE, sections: [] } });
    expect(testApp.clients.catalog.getPublishedCourse).toHaveBeenCalledWith(COURSE.slug);
  });

  it("answers 404 for a draft or missing course", async () => {
    testApp.clients.catalog.getPublishedCourse.mockRejectedValue(new CourseNotFoundError());

    const response = await testApp.app.inject({ method: "GET", url: `${BASE_URL}/draft` });

    expect(response.statusCode).toBe(404);
  });

  it("answers 404 and opens no catalog when no school has the subdomain", async () => {
    testApp.clients.schools.getSchoolBySubdomain.mockRejectedValue(new SchoolNotFoundError());

    const response = await testApp.app.inject({ method: "GET", url: "/schools/by-subdomain/missing/courses" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ type: "urn:reanit:problem:school-not-found" });
    expect(testApp.clients.catalogFor).not.toHaveBeenCalled();
  });
});
