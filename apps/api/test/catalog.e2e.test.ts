import { randomUUID } from "node:crypto";

import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { openSchool, signUp, uniqueName, useE2eApp, type Agent } from "../src/test/e2e";

const e2e = useE2eApp();
let alpha: Awaited<ReturnType<typeof openSchool>>;
let beta: Awaited<ReturnType<typeof openSchool>>;

beforeAll(async () => {
  alpha = await openSchool(e2e().app, uniqueName("catalog-alpha"));
  beta = await openSchool(e2e().app, uniqueName("catalog-beta"));
});

/**
 * Builds a one-section, one-lesson outline with fresh ids.
 *
 * @returns The outline.
 */
function outline() {
  return {
    sections: [
      {
        id: randomUUID(),
        title: "Basics",
        lessons: [{ id: randomUUID(), title: "Hello", type: "video", durationSeconds: 90 }],
      },
    ],
  };
}

/**
 * Creates a course through the API.
 *
 * @param agent The owner's agent.
 * @param title The course title.
 * @returns The new course.
 */
async function createCourse(agent: Agent, title: string) {
  const response = await agent.post("/courses").send({ title }).expect(201);
  return response.body.course as { id: string; slug: string; status: string };
}

describe("course builder", () => {
  it("creates a draft, saves its outline and reads both back", async () => {
    const course = await createCourse(alpha.agent, "Intro to Design");
    const saved = outline();

    await alpha.agent.put(`/courses/${course.id}/outline`).send(saved).expect(204);
    const loaded = await alpha.agent.get(`/courses/by-slug/${course.slug}`).expect(200);

    expect(course.status).toBe("draft");
    expect(loaded.body.course).toMatchObject({ id: course.id, sections: saved.sections });
  });

  it("updates and deletes a course, then 404s for it", async () => {
    const course = await createCourse(alpha.agent, "Short-lived");

    const updated = await alpha.agent.patch(`/courses/${course.id}`).send({ description: "Soon gone" }).expect(200);
    expect(updated.body.course.description).toBe("Soon gone");

    await alpha.agent.delete(`/courses/${course.id}`).expect(204);
    const missing = await alpha.agent.delete(`/courses/${course.id}`).expect(404);
    expect(missing.body.type).toBe("urn:reanit:problem:course-not-found");
  });

  it("answers 400 for an invalid outline", async () => {
    const course = await createCourse(alpha.agent, "Strict");

    await alpha.agent.put(`/courses/${course.id}/outline`).send({ sections: [{ id: "nope" }] }).expect(400);
  });

  it("answers 401 to a signed-out caller and 403 to a user who runs no school", async () => {
    await request(e2e().app.getHttpServer()).get("/courses").expect(401);
    const { agent } = await signUp(e2e().app, uniqueName("catalog-student"));

    await agent.get("/courses").expect(403);
  });
});

describe("tenant isolation", () => {
  it("shows another school nothing of this school's courses", async () => {
    const course = await createCourse(alpha.agent, "Alpha Only");

    const list = await beta.agent.get("/courses").expect(200);
    expect(list.body.courses.map(({ id }: { id: string }) => id)).not.toContain(course.id);

    await beta.agent.get(`/courses/by-slug/${course.slug}`).expect(404);
    await beta.agent.patch(`/courses/${course.id}`).send({ title: "Taken over" }).expect(404);
    await beta.agent.put(`/courses/${course.id}/outline`).send(outline()).expect(404);
    await beta.agent.delete(`/courses/${course.id}`).expect(404);

    const unchanged = await alpha.agent.get(`/courses/by-slug/${course.slug}`).expect(200);
    expect(unchanged.body.course.title).toBe("Alpha Only");
  });
});

describe("public catalog", () => {
  it("lists and shows a course only once it is published, and only on its own school", async () => {
    const course = await createCourse(alpha.agent, "Going Live");
    const anonymous = request(e2e().app.getHttpServer());
    const alphaCatalog = `/schools/by-subdomain/${alpha.school.subdomain}/courses`;
    const betaCatalog = `/schools/by-subdomain/${beta.school.subdomain}/courses`;

    const before = await anonymous.get(alphaCatalog).expect(200);
    expect(before.body.courses.map(({ id }: { id: string }) => id)).not.toContain(course.id);
    await anonymous.get(`${alphaCatalog}/${course.slug}`).expect(404);

    await alpha.agent.patch(`/courses/${course.id}`).send({ status: "published" }).expect(200);

    const after = await anonymous.get(alphaCatalog).expect(200);
    expect(after.body.courses.map(({ id }: { id: string }) => id)).toContain(course.id);
    await anonymous.get(`${alphaCatalog}/${course.slug}`).expect(200);
    await anonymous.get(`${betaCatalog}/${course.slug}`).expect(404);
  });

  it("404s for a school that does not exist", async () => {
    await request(e2e().app.getHttpServer()).get(`/schools/by-subdomain/${uniqueName("ghost")}/courses`).expect(404);
  });
});
