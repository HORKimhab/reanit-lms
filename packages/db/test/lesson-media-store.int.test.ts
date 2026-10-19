import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createDbClient, createLessonMediaStore, createSchoolStore } from "../src";

const db = createDbClient(inject("databaseUrl"));
const lessonId = randomUUID();
let alphaId: string;
let betaId: string;

/**
 * Opens a school with an owner.
 *
 * @param subdomain Unique subdomain.
 * @returns The school's id.
 */
async function openSchool(subdomain: string) {
  const owner = await db.user.create({ data: { email: `${subdomain}@example.com` } });
  return (await createSchoolStore(db).createSchoolWithOwner({ name: subdomain, subdomain, ownerId: owner.id })).id;
}

beforeAll(async () => {
  alphaId = await openSchool("media-alpha");
  betaId = await openSchool("media-beta");
  const catalog = createCatalogStore(db, alphaId);
  const course = await catalog.createCourse({ title: "Video course", slug: "video-course" });
  await catalog.replaceOutline(course.id, {
    sections: [{ id: randomUUID(), title: "One", lessons: [{ id: lessonId, title: "Intro", type: "video", durationSeconds: 60 }] }],
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

  it("shows another school nothing and lets it change nothing", async () => {
    const before = await createLessonMediaStore(db, alphaId).findLesson(lessonId);
    const beta = createLessonMediaStore(db, betaId);

    expect(await beta.findLesson(lessonId)).toBeNull();
    await beta.setMediaKey(lessonId, "schools/beta/lessons/x/evil.mp4");

    expect(await createLessonMediaStore(db, alphaId).findLesson(lessonId)).toEqual(before);
  });
});
