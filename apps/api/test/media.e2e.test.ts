import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { createVideoCourse, openSchool, uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp();
const videoLesson = randomUUID();
const textLesson = randomUUID();
let alpha: Awaited<ReturnType<typeof openSchool>>;
let beta: Awaited<ReturnType<typeof openSchool>>;

beforeAll(async () => {
  alpha = await openSchool(e2e().app, uniqueName("media-alpha"));
  beta = await openSchool(e2e().app, uniqueName("media-beta"));
  await createVideoCourse(alpha.agent, "Video course", { video: videoLesson, text: textLesson });
});

describe("lesson media", () => {
  it("uploads, attaches and previews a lesson's video", async () => {
    const upload = await alpha.agent
      .post(`/lessons/${videoLesson}/media/uploads`)
      .send({ contentType: "video/mp4", sizeBytes: 1_000_000 })
      .expect(201);
    const { key } = upload.body;
    expect(key).toMatch(new RegExp(`^schools/${alpha.school.id}/lessons/${videoLesson}/[0-9a-f-]+\\.mp4$`));

    await alpha.agent.get(`/lessons/${videoLesson}/media`).expect(404);
    await alpha.agent.put(`/lessons/${videoLesson}/media`).send({ key }).expect(409);
    e2e().storage.uploaded.add(key);
    await alpha.agent.put(`/lessons/${videoLesson}/media`).send({ key }).expect(204);

    const playback = await alpha.agent.get(`/lessons/${videoLesson}/media`).expect(200);
    expect(playback.body.url).toBe(`https://storage.test/${key}?signed`);
  });

  it("refuses a file for a text lesson with 415", async () => {
    const response = await alpha.agent
      .post(`/lessons/${textLesson}/media/uploads`)
      .send({ contentType: "video/mp4", sizeBytes: 1000 })
      .expect(415);

    expect(response.body.type).toBe("urn:reanit:problem:unsupported-media");
  });

  it("shows another school nothing of this school's lessons", async () => {
    await beta.agent.post(`/lessons/${videoLesson}/media/uploads`).send({ contentType: "video/mp4", sizeBytes: 1000 }).expect(404);
    await beta.agent.get(`/lessons/${videoLesson}/media`).expect(404);

    const forged = `schools/${beta.school.id}/lessons/${videoLesson}/forged.mp4`;
    e2e().storage.uploaded.add(forged);
    await beta.agent.put(`/lessons/${videoLesson}/media`).send({ key: forged }).expect(404);
  });
});
