import { LessonMediaMissingError } from "@reanit/core/media";
import { NotEnrolledError } from "@reanit/core/learning";
import { describe, expect, it } from "vitest";

import { type FakeClients, useTestApp } from "../test/app";
import { signInAs, TEST_SCHOOL, TEST_USER } from "../test/session";

const BASE_URL = `/schools/by-subdomain/${TEST_SCHOOL.subdomain}`;
const LESSON_ID = "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a99";
const COURSE = {
  id: "8d7c6b5a-4f3e-4d2c-9b1a-0f9e8d7c6b5a",
  title: "Brand Design Basics",
  slug: "brand",
  description: null,
  status: "published",
  sections: [
    {
      id: "1c2b3a49-8f7e-4d6c-9b5a-4e3d2c1b0a11",
      title: "Start",
      lessons: [{ id: LESSON_ID, title: "Welcome", type: "video", durationSeconds: 60, hasMedia: true }],
    },
  ],
  progress: [{ lessonId: LESSON_ID, positionSeconds: 30, isCompleted: false }],
};

/**
 * Makes every subdomain resolve to `TEST_SCHOOL`.
 *
 * @param clients Fakes from `createFakeClients`.
 */
function resolveTestSchool(clients: FakeClients) {
  clients.schools.getSchoolBySubdomain.mockResolvedValue(TEST_SCHOOL);
}

const testApp = useTestApp(resolveTestSchool);

describe("GET .../learn/:slug", () => {
  it("gives the signed-in student the course with their progress, in the subdomain's school", async () => {
    const headers = signInAs(testApp.clients);
    testApp.clients.learning.getCourse.mockResolvedValue(COURSE);

    const response = await testApp.app.inject({ method: "GET", url: `${BASE_URL}/learn/brand`, headers });

    expect(response.json()).toEqual({ course: COURSE });
    expect(testApp.clients.learningFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(testApp.clients.learning.getCourse).toHaveBeenCalledWith(TEST_USER.id, "brand");
  });

  it("answers 403 to a student who is not enrolled and 401 when signed out", async () => {
    const headers = signInAs(testApp.clients);
    testApp.clients.learning.getCourse.mockRejectedValue(new NotEnrolledError());

    const response = await testApp.app.inject({ method: "GET", url: `${BASE_URL}/learn/brand`, headers });

    expect(response.statusCode).toBe(403);
    expect(response.json().type).toBe("urn:reanit:problem:not-enrolled");
    expect((await testApp.app.inject({ method: "GET", url: `${BASE_URL}/learn/brand` })).statusCode).toBe(401);
  });
});

describe("GET .../lessons/:lessonId/media", () => {
  it("signs the lesson's file for the student", async () => {
    const headers = signInAs(testApp.clients);
    const expiresAt = new Date("2026-10-19T04:00:00Z");
    testApp.clients.learning.getLessonMedia.mockResolvedValue({ url: "https://storage.test/a.mp4", expiresAt });

    const response = await testApp.app.inject({ method: "GET", url: `${BASE_URL}/lessons/${LESSON_ID}/media`, headers });

    expect(response.json()).toEqual({ url: "https://storage.test/a.mp4", expiresAt: expiresAt.toISOString() });
    expect(testApp.clients.learning.getLessonMedia).toHaveBeenCalledWith(TEST_USER.id, LESSON_ID);
  });

  it("answers 404 when the lesson has no file", async () => {
    const headers = signInAs(testApp.clients);
    testApp.clients.learning.getLessonMedia.mockRejectedValue(new LessonMediaMissingError());

    expect((await testApp.app.inject({ method: "GET", url: `${BASE_URL}/lessons/${LESSON_ID}/media`, headers })).statusCode).toBe(404);
  });
});

describe("PUT .../lessons/:lessonId/progress", () => {
  it("saves the heartbeat for the student", async () => {
    const headers = signInAs(testApp.clients);

    const response = await testApp.app.inject({ method: "PUT", url: `${BASE_URL}/lessons/${LESSON_ID}/progress`, headers, payload: { positionSeconds: 45 } });

    expect(response.statusCode).toBe(204);
    expect(testApp.clients.learning.recordProgress).toHaveBeenCalledWith(TEST_USER.id, LESSON_ID, { positionSeconds: 45 });
  });

  it.each([[{}], [{ positionSeconds: -1 }], [{ completed: false }]])("answers 400 to %j and saves nothing", async (payload) => {
    const headers = signInAs(testApp.clients);

    const response = await testApp.app.inject({ method: "PUT", url: `${BASE_URL}/lessons/${LESSON_ID}/progress`, headers, payload });

    expect(response.statusCode).toBe(400);
    expect(testApp.clients.learning.recordProgress).not.toHaveBeenCalled();
  });
});
