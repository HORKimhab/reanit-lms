import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createDbClient, createLessonMediaStore } from "../src";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const lessonId = randomUUID();
let alphaId: string;
let betaId: string;

beforeAll(async () => {
  alphaId = await openTestSchool(db, "media-alpha");
  betaId = await openTestSchool(db, "media-beta");
  const catalog = createCatalogStore(db, alphaId);
  const course = await catalog.createCourse({ title: "Video course", slug: "video-course" });
  await catalog.replaceOutline(course.id, {
    sections: [{ id: randomUUID(), title: "One", lessons: [{ id: lessonId, title: "Intro", type: "video", durationSeconds: 60, unlockAfterDays: null, unlockAt: null }] }],
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("lesson media store", () => {
  it("finds a lesson without a file, then with the attached one", async () => {
    const store = createLessonMediaStore(db, alphaId);
    expect(await store.findLesson(lessonId)).toEqual({ id: lessonId, type: "video", mediaKey: null });

    await store.setMediaKey(lessonId, `schools/${alphaId}/lessons/${lessonId}/a.mp4`);

    expect((await store.findLesson(lessonId))?.mediaKey).toBe(`schools/${alphaId}/lessons/${lessonId}/a.mp4`);
  });

  it("flags the lesson as having a file when its course is loaded, without exposing the key", async () => {
    await createLessonMediaStore(db, alphaId).setMediaKey(lessonId, `schools/${alphaId}/lessons/${lessonId}/b.mp4`);

    const course = await createCatalogStore(db, alphaId).findCourseBySlug("video-course");

    expect(course?.sections[0]?.lessons).toEqual([{ id: lessonId, title: "Intro", type: "video", durationSeconds: 60, hasMedia: true, unlockAfterDays: null, unlockAt: null }]);
  });

  it("shows another school nothing and lets it change nothing", async () => {
    const before = await createLessonMediaStore(db, alphaId).findLesson(lessonId);
    const beta = createLessonMediaStore(db, betaId);

    expect(await beta.findLesson(lessonId)).toBeNull();
    await beta.setMediaKey(lessonId, "schools/beta/lessons/x/evil.mp4");

    expect(await createLessonMediaStore(db, alphaId).findLesson(lessonId)).toEqual(before);
  });
});
