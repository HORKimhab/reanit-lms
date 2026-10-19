import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createDbClient, createLearningStore } from "../src";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const LESSONS = [randomUUID(), randomUUID()] as const;
let alphaId: string;
let betaId: string;
let courseId: string;
let studentId: string;
let enrollmentId: string;

beforeAll(async () => {
  alphaId = await openTestSchool(db, "learning-alpha");
  betaId = await openTestSchool(db, "learning-beta");
  const catalog = createCatalogStore(db, alphaId);
  courseId = (await catalog.createCourse({ title: "Played", slug: "played" })).id;
  await catalog.replaceOutline(courseId, {
    sections: [
      {
        id: randomUUID(),
        title: "Start",
        lessons: LESSONS.map((id) => ({ id, title: id, type: "video" as const, durationSeconds: 60 })),
      },
    ],
  });
  studentId = (await db.user.create({ data: { email: "learning-student@example.com" } })).id;
  enrollmentId = (await db.enrollment.create({ data: { schoolId: alphaId, userId: studentId, courseId, source: "manual" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("learning store", () => {
  it("finds a student's enrollment by course and by lesson, never from another school", async () => {
    const store = createLearningStore(db, alphaId);
    const enrollment = { id: enrollmentId, courseId, expiresAt: null };

    expect(await store.findEnrollment(studentId, courseId)).toEqual(enrollment);
    expect(await store.findEnrollmentForLesson(studentId, LESSONS[1])).toEqual(enrollment);
    expect(await store.findEnrollmentForLesson(studentId, randomUUID())).toBeNull();
    expect(await store.findEnrollment(randomUUID(), courseId)).toBeNull();
    expect(await createLearningStore(db, betaId).findEnrollment(studentId, courseId)).toBeNull();
    expect(await createLearningStore(db, betaId).findEnrollmentForLesson(studentId, LESSONS[0])).toBeNull();
  });

  it("saves the video position and keeps a lesson completed once it is", async () => {
    const store = createLearningStore(db, alphaId);

    await store.saveProgress(enrollmentId, LESSONS[0], { positionSeconds: 30 });
    await store.saveProgress(enrollmentId, LESSONS[0], { completed: true });
    await store.saveProgress(enrollmentId, LESSONS[0], { positionSeconds: 12 });

    expect(await store.listProgress(enrollmentId)).toEqual([{ lessonId: LESSONS[0], positionSeconds: 12, isCompleted: true }]);
    expect(await store.countLessons(enrollmentId, courseId)).toEqual({ completed: 1, total: 2 });
    expect(await createLearningStore(db, betaId).listProgress(enrollmentId)).toEqual([]);
  });

  it("completes the course and counts it in the day's completions once", async () => {
    const store = createLearningStore(db, alphaId);
    const at = new Date("2026-10-19T23:59:00Z");

    await store.completeCourse({ id: enrollmentId, courseId }, at);
    await store.completeCourse({ id: enrollmentId, courseId }, new Date("2026-10-20T01:00:00Z"));

    expect((await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).completedAt).toEqual(at);
    expect(await db.dailyCompletions.findMany({ where: { courseId }, select: { day: true, completions: true } })).toEqual([
      { day: new Date("2026-10-19T00:00:00Z"), completions: 1 },
    ]);
  });
});
