import { LessonMediaMissingError } from "@reanit/core/media";
import { LessonLockedError, NotCommentAuthorError, NotEnrolledError } from "@reanit/core/learning";
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
      lessons: [{ id: LESSON_ID, title: "Welcome", type: "video", durationSeconds: 60, hasMedia: true, unlockAfterDays: 3, unlockAt: null }],
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
    testApp.clients.learning.getCourse.mockResolvedValue({ ...COURSE, enrolledAt: new Date("2026-10-01T09:00:00Z") });

    const response = await testApp.app.inject({ method: "GET", url: `${BASE_URL}/learn/brand`, headers });

    expect(response.json()).toEqual({ course: { ...COURSE, enrolledAt: "2026-10-01T09:00:00.000Z" } });
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

describe("quiz routes", () => {
  const QUESTION_ID = "1c2b3a49-8f7e-4d6c-9b5a-4e3d2c1b0a21";
  const OPTION_ID = "1c2b3a49-8f7e-4d6c-9b5a-4e3d2c1b0a22";

  it("gives the student the quiz with their last attempt's time as an ISO date", async () => {
    const headers = signInAs(testApp.clients);
    const quiz = { passPercent: 70, questions: [{ id: QUESTION_ID, prompt: "Pick red", kind: "single", options: [{ id: OPTION_ID, text: "Red" }] }] };
    testApp.clients.learning.getQuiz.mockResolvedValue({ ...quiz, lastAttempt: { scorePercent: 50, isPassed: false, at: new Date("2026-10-20T01:00:00Z") } });

    const response = await testApp.app.inject({ method: "GET", url: `${BASE_URL}/lessons/${LESSON_ID}/quiz`, headers });

    expect(response.json()).toEqual({ quiz: { ...quiz, lastAttempt: { scorePercent: 50, isPassed: false, at: "2026-10-20T01:00:00.000Z" } } });
    expect(testApp.clients.learning.getQuiz).toHaveBeenCalledWith(TEST_USER.id, LESSON_ID);
  });

  it("grades the signed-in student's answers", async () => {
    const headers = signInAs(testApp.clients);
    const result = { scorePercent: 100, isPassed: true, questions: [{ questionId: QUESTION_ID, isCorrect: true }] };
    testApp.clients.learning.submitQuiz.mockResolvedValue(result);
    const answers = [{ questionId: QUESTION_ID, optionIds: [OPTION_ID] }];

    const response = await testApp.app.inject({ method: "POST", url: `${BASE_URL}/lessons/${LESSON_ID}/quiz/attempts`, headers, payload: { answers } });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ result });
    expect(testApp.clients.learning.submitQuiz).toHaveBeenCalledWith(TEST_USER.id, LESSON_ID, answers);
  });

  it("answers 403 lesson-locked for a drip lesson that has not opened", async () => {
    const headers = signInAs(testApp.clients);
    testApp.clients.learning.getQuiz.mockRejectedValue(new LessonLockedError(new Date("2026-10-25T00:00:00Z")));

    const response = await testApp.app.inject({ method: "GET", url: `${BASE_URL}/lessons/${LESSON_ID}/quiz`, headers });

    expect(response.json()).toMatchObject({ status: 403, type: "urn:reanit:problem:lesson-locked" });
  });

  it("answers 403 to a student who is not enrolled", async () => {
    const headers = signInAs(testApp.clients);
    testApp.clients.learning.submitQuiz.mockRejectedValue(new NotEnrolledError());

    const response = await testApp.app.inject({ method: "POST", url: `${BASE_URL}/lessons/${LESSON_ID}/quiz/attempts`, headers, payload: { answers: [] } });

    expect(response.statusCode).toBe(403);
  });
});

describe("comment routes", () => {
  const COMMENT_ID = "1c2b3a49-8f7e-4d6c-9b5a-4e3d2c1b0a31";
  const AT = new Date("2026-10-20T01:00:00Z");
  const COMMENT = { id: COMMENT_ID, body: "Hello", author: { id: TEST_USER.id, name: "Dara", isStaff: false }, isHidden: false, createdAt: AT };

  it("lists the lesson's threads for the signed-in student", async () => {
    const headers = signInAs(testApp.clients);
    testApp.clients.learning.listComments.mockResolvedValue([{ ...COMMENT, lessonId: LESSON_ID, replies: [COMMENT] }]);

    const response = await testApp.app.inject({ method: "GET", url: `${BASE_URL}/lessons/${LESSON_ID}/comments`, headers });

    expect(response.json().threads[0].replies[0].createdAt).toBe(AT.toISOString());
    expect(testApp.clients.learning.listComments).toHaveBeenCalledWith(TEST_USER.id, LESSON_ID);
  });

  it("posts the student's comment, trimmed", async () => {
    const headers = signInAs(testApp.clients);
    testApp.clients.learning.postComment.mockResolvedValue(COMMENT);

    const response = await testApp.app.inject({ method: "POST", url: `${BASE_URL}/lessons/${LESSON_ID}/comments`, headers, payload: { body: " Hello " } });

    expect(response.statusCode).toBe(201);
    expect(testApp.clients.learning.postComment).toHaveBeenCalledWith(TEST_USER.id, LESSON_ID, { body: "Hello" });
  });

  it("answers 400 for a blank comment", async () => {
    const headers = signInAs(testApp.clients);

    const response = await testApp.app.inject({ method: "POST", url: `${BASE_URL}/lessons/${LESSON_ID}/comments`, headers, payload: { body: "  " } });

    expect(response.statusCode).toBe(400);
  });

  it("deletes the student's own comment and answers 403 for someone else's", async () => {
    const headers = signInAs(testApp.clients);
    testApp.clients.learning.deleteComment.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new NotCommentAuthorError());

    const mine = await testApp.app.inject({ method: "DELETE", url: `${BASE_URL}/comments/${COMMENT_ID}`, headers });
    const theirs = await testApp.app.inject({ method: "DELETE", url: `${BASE_URL}/comments/${COMMENT_ID}`, headers });

    expect(mine.statusCode).toBe(204);
    expect(theirs.json()).toMatchObject({ status: 403, type: "urn:reanit:problem:not-comment-author" });
  });
});
