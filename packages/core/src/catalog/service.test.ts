import { beforeEach, describe, expect, it } from "vitest";

import { FakeCatalogStore } from "../test/catalog-fakes";
import { CourseNotFoundError } from "./errors";
import { createCatalogService, type CatalogService } from "./service";

const OUTLINE = {
  sections: [
    {
      id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01",
      title: "Basics",
      lessons: [{ id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a02", title: "Hello", type: "video" as const, durationSeconds: 90 }],
    },
  ],
};

let store: FakeCatalogStore;
let catalog: CatalogService;

beforeEach(() => {
  store = new FakeCatalogStore();
  catalog = createCatalogService({ store });
});

describe("catalog service", () => {
  it("creates a draft course with a free slug", async () => {
    await catalog.createCourse({ title: "Intro" });

    const course = await catalog.createCourse({ title: "Intro" });

    expect(course).toEqual({ id: "course-2", title: "Intro", slug: "intro-2", description: null, status: "draft" });
  });

  it("lists courses newest first", async () => {
    await catalog.createCourse({ title: "First" });
    await catalog.createCourse({ title: "Second" });

    expect((await catalog.listCourses()).map((course) => course.title)).toEqual(["Second", "First"]);
  });

  it("loads a course with its saved outline", async () => {
    const { id, slug } = await catalog.createCourse({ title: "Intro" });
    await catalog.saveOutline(id, OUTLINE);

    expect(await catalog.getCourse(slug)).toMatchObject({ id, sections: OUTLINE.sections });
  });

  it("updates a course's details", async () => {
    const { id } = await catalog.createCourse({ title: "Intro" });

    expect(await catalog.updateCourse(id, { status: "published", description: "Learn" })).toMatchObject({
      status: "published",
      description: "Learn",
      slug: "intro",
    });
  });

  it("deletes a course", async () => {
    const { id } = await catalog.createCourse({ title: "Intro" });

    await catalog.deleteCourse(id);

    expect(await catalog.listCourses()).toEqual([]);
  });

  it.each([
    ["getCourse", () => catalog.getCourse("missing")],
    ["updateCourse", () => catalog.updateCourse("missing", { title: "x" })],
    ["deleteCourse", () => catalog.deleteCourse("missing")],
    ["saveOutline", () => catalog.saveOutline("missing", OUTLINE)],
  ])("throws CourseNotFoundError from %s when the course is missing", async (_name, call) => {
    await expect(call()).rejects.toThrow(CourseNotFoundError);
  });
});
