import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { CourseNotFoundError, type Course } from "@reanit/core/catalog";
import { SchoolNotFoundError } from "@reanit/core/schools";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFakeClients, createTestApp, type FakeClients } from "../test/app";
import { TEST_SCHOOL } from "../test/session";

const COURSE: Course = {
  id: "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a99",
  title: "Intro to Design",
  slug: "intro-to-design",
  description: "Learn the basics.",
  status: "published",
};
const BASE_URL = `/schools/by-subdomain/${TEST_SCHOOL.subdomain}/courses`;

let clients: FakeClients;
let app: NestFastifyApplication;

beforeEach(async () => {
  clients = createFakeClients();
  clients.schools.getSchoolBySubdomain.mockResolvedValue(TEST_SCHOOL);
  app = await createTestApp(clients);
});

afterEach(async () => {
  await app.close();
});

describe("public catalog", () => {
  it("lists the school's published courses to signed-out callers", async () => {
    clients.catalog.listPublishedCourses.mockResolvedValue([COURSE]);

    const response = await app.inject({ method: "GET", url: BASE_URL });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ courses: [COURSE] });
    expect(clients.schools.getSchoolBySubdomain).toHaveBeenCalledWith(TEST_SCHOOL.subdomain);
    expect(clients.catalogFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
  });

  it("loads a published course with its outline", async () => {
    clients.catalog.getPublishedCourse.mockResolvedValue({ ...COURSE, sections: [] });

    const response = await app.inject({ method: "GET", url: `${BASE_URL}/${COURSE.slug}` });

    expect(response.json()).toEqual({ course: { ...COURSE, sections: [] } });
    expect(clients.catalog.getPublishedCourse).toHaveBeenCalledWith(COURSE.slug);
  });

  it("answers 404 for a draft or missing course", async () => {
    clients.catalog.getPublishedCourse.mockRejectedValue(new CourseNotFoundError());

    const response = await app.inject({ method: "GET", url: `${BASE_URL}/draft` });

    expect(response.statusCode).toBe(404);
  });

  it("answers 404 and opens no catalog when no school has the subdomain", async () => {
    clients.schools.getSchoolBySubdomain.mockRejectedValue(new SchoolNotFoundError());

    const response = await app.inject({ method: "GET", url: "/schools/by-subdomain/missing/courses" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ type: "urn:reanit:problem:school-not-found" });
    expect(clients.catalogFor).not.toHaveBeenCalled();
  });
});
