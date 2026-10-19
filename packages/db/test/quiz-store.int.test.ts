import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createDbClient, createQuizStore } from "../src";
import { enrollTestStudent, openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const QUIZ_LESSON = randomUUID();
const TEXT_LESSON = randomUUID();
const QUIZ = {
  passPercent: 80,
  questions: [
    {
      id: randomUUID(),
      prompt: "Pick red",
      kind: "single" as const,
      options: [
        { id: randomUUID(), text: "Red", isCorrect: true },
        { id: randomUUID(), text: "Blue", isCorrect: false },
      ],
    },
  ],
};
let alphaId: string;
let betaId: string;
let enrollmentId: string;

beforeAll(async () => {
  alphaId = await openTestSchool(db, "quiz-alpha");
  betaId = await openTestSchool(db, "quiz-beta");
  const catalog = createCatalogStore(db, alphaId);
  const courseId = (await catalog.createCourse({ title: "Quizzed", slug: "quizzed" })).id;
  await catalog.replaceOutline(courseId, {
    sections: [
      {
        id: randomUUID(),
        title: "Check",
        lessons: [
          { id: TEXT_LESSON, title: "Read", type: "text", durationSeconds: 0 },
          { id: QUIZ_LESSON, title: "Quiz", type: "quiz", durationSeconds: 0 },
        ],
      },
    ],
  });
  ({ enrollmentId } = await enrollTestStudent(db, { schoolId: alphaId, courseId }, "quiz-student@example.com"));
});

afterAll(async () => {
  await db.$disconnect();
});

describe("quiz store", () => {
  it("reads a lesson's type, and nothing of another school's lesson", async () => {
    expect(await createQuizStore(db, alphaId).findLessonType(QUIZ_LESSON)).toBe("quiz");
    expect(await createQuizStore(db, alphaId).findLessonType(TEXT_LESSON)).toBe("text");
    expect(await createQuizStore(db, betaId).findLessonType(QUIZ_LESSON)).toBeNull();
  });

  it("saves a quiz and replaces it on the next save", async () => {
    const store = createQuizStore(db, alphaId);
    expect(await store.findQuiz(QUIZ_LESSON)).toBeNull();

    await store.saveQuiz(QUIZ_LESSON, { ...QUIZ, passPercent: 50 });
    await store.saveQuiz(QUIZ_LESSON, QUIZ);

    expect(await store.findQuiz(QUIZ_LESSON)).toEqual(QUIZ);
    expect(await createQuizStore(db, betaId).findQuiz(QUIZ_LESSON)).toBeNull();
  });

  it("keeps attempts and finds the latest", async () => {
    const store = createQuizStore(db, alphaId);
    const answers = [{ questionId: QUIZ.questions[0]!.id, optionIds: [] }];

    await store.recordAttempt({ enrollmentId, lessonId: QUIZ_LESSON, answers, result: { scorePercent: 0, isPassed: false }, at: new Date("2026-10-20T01:00:00Z") });
    await store.recordAttempt({ enrollmentId, lessonId: QUIZ_LESSON, answers, result: { scorePercent: 100, isPassed: true }, at: new Date("2026-10-20T02:00:00Z") });

    expect(await store.findLastAttempt(enrollmentId, QUIZ_LESSON)).toEqual({ scorePercent: 100, isPassed: true, at: new Date("2026-10-20T02:00:00Z") });
    expect(await store.findLastAttempt(enrollmentId, TEXT_LESSON)).toBeNull();
    expect(await createQuizStore(db, betaId).findLastAttempt(enrollmentId, QUIZ_LESSON)).toBeNull();
  });

  it("refuses a pass mark outside 1 to 100", async () => {
    await expect(createQuizStore(db, alphaId).saveQuiz(QUIZ_LESSON, { ...QUIZ, passPercent: 0 })).rejects.toThrow();
  });
});
