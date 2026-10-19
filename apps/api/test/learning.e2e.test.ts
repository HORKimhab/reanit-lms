import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { buyCourse, createVideoCourse, openSchool, signUp, uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp();
const videoLesson = randomUUID();
const textLesson = randomUUID();
let alpha: Awaited<ReturnType<typeof openSchool>>;
let course: { id: string; slug: string };
let base: string;

beforeAll(async () => {
  alpha = await openSchool(e2e().app, uniqueName("learn-alpha"));
  base = `/schools/by-subdomain/${alpha.school.subdomain}`;
  course = await createVideoCourse(alpha.agent, "Played Course", { video: videoLesson, text: textLesson });
  await alpha.agent.patch(`/courses/${course.id}`).send({ status: "published" }).expect(200);
  await alpha.agent.put(`/courses/${course.id}/price`).send({ amount: 4900, currency: "USD" }).expect(200);
  const { key } = (await alpha.agent.post(`/lessons/${videoLesson}/media/uploads`).send({ contentType: "video/mp4", sizeBytes: 1000 }).expect(201)).body;
  e2e().storage.uploaded.add(key);
  await alpha.agent.put(`/lessons/${videoLesson}/media`).send({ key }).expect(204);
});

describe("learning", () => {
  it("opens the player to a buyer only, saves progress, and counts the sale and the completion in the stats", async () => {
    const { agent: student } = await signUp(e2e().app, uniqueName("student"));
    await student.get(`${base}/learn/${course.slug}`).expect(403);
    await student.put(`${base}/lessons/${videoLesson}/progress`).send({ positionSeconds: 5 }).expect(403);

    await buyCourse(e2e(), student, alpha.school.subdomain, course.slug);
    const player = await student.get(`${base}/learn/${course.slug}`).expect(200);
    expect(player.body.course).toMatchObject({ id: course.id, progress: [] });
    expect((await student.get(`${base}/lessons/${videoLesson}/media`).expect(200)).body.url).toMatch(/^https:\/\/storage\.test\/.+\.mp4\?signed$/);
    await student.get(`${base}/lessons/${textLesson}/media`).expect(404);

    await student.put(`${base}/lessons/${videoLesson}/progress`).send({ positionSeconds: 42 }).expect(204);
    await student.put(`${base}/lessons/${videoLesson}/progress`).send({ completed: true }).expect(204);
    await student.put(`${base}/lessons/${textLesson}/progress`).send({ completed: true }).expect(204);
    await student.put(`${base}/lessons/${textLesson}/progress`).send({ completed: true }).expect(204);

    const progress = (await student.get(`${base}/learn/${course.slug}`).expect(200)).body.course.progress;
    expect(progress).toEqual(
      expect.arrayContaining([
        { lessonId: videoLesson, positionSeconds: 42, isCompleted: true },
        { lessonId: textLesson, positionSeconds: 0, isCompleted: true },
      ]),
    );
    const stats = (await alpha.agent.get("/stats/courses").expect(200)).body.courses;
    expect(stats).toEqual([{ courseId: course.id, title: "Played Course", slug: course.slug, students: 1, completions: 1, revenue: [{ currency: "USD", amount: 4900 }] }]);
  });

  it("keeps a lesson closed to another school's site and its stats to other schools", async () => {
    const { agent: student } = await signUp(e2e().app, uniqueName("student-cross"));
    await buyCourse(e2e(), student, alpha.school.subdomain, course.slug);
    const beta = await openSchool(e2e().app, uniqueName("learn-beta"));

    await student.get(`/schools/by-subdomain/${beta.school.subdomain}/lessons/${videoLesson}/media`).expect(403);
    await student.get(`/schools/by-subdomain/${beta.school.subdomain}/learn/${course.slug}`).expect(404);
    expect((await beta.agent.get("/stats/courses").expect(200)).body.courses).toEqual([]);
  });
});
