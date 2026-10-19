import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createDbClient, createSchoolStore } from "../src";

const db = createDbClient(inject("databaseUrl"));
let alphaSchoolId: string;
let alpha: ReturnType<typeof createCatalogStore>;
let beta: ReturnType<typeof createCatalogStore>;

/**
 * Opens a school with an owner and returns its catalog store.
 *
 * @param subdomain Unique subdomain.
 * @returns The school's id and catalog store.
 */
async function openSchool(subdomain: string) {
  const owner = await db.user.create({ data: { email: `${subdomain}@example.com` } });
  const school = await createSchoolStore(db).createSchoolWithOwner({ name: subdomain, subdomain, ownerId: owner.id });
  return { schoolId: school.id, store: createCatalogStore(db, school.id) };
}

/**
 * Builds an outline lesson.
 *
 * @param title Lesson title.
 * @param id Existing id to keep; a new one otherwise.
 * @returns The lesson.
 */
function lesson(title: string, id: string = randomUUID()) {
  return { id, title, type: "video" as const, durationSeconds: 60 };
}

/**
 * Describes sections as a loaded course lists them: lessons without files say so.
 *
 * @param sections Saved sections.
 * @returns The sections with `hasMedia: false` on each lesson.
 */
function asLoaded(sections: { id: string; title: string; lessons: ReturnType<typeof lesson>[] }[]) {
  return sections.map((section) => ({ ...section, lessons: section.lessons.map((saved) => ({ ...saved, hasMedia: false })) }));
}

beforeAll(async () => {
  ({ schoolId: alphaSchoolId, store: alpha } = await openSchool("catalog-alpha"));
  ({ store: beta } = await openSchool("catalog-beta"));
});

afterAll(async () => {
  await db.$disconnect();
});

describe("catalog store", () => {
  it("creates draft courses and lists them newest first", async () => {
    const first = await alpha.createCourse({ title: "First", slug: "first" });
    const second = await alpha.createCourse({ title: "Second", slug: "second" });

    expect(first).toEqual({ id: expect.any(String), title: "First", slug: "first", description: null, status: "draft" });
    expect((await alpha.listCourses()).slice(0, 2)).toEqual([second, first]);
    expect(await alpha.listCourseSlugs()).toEqual(expect.arrayContaining(["first", "second"]));
  });

  it("never lists or finds another school's courses", async () => {
    await beta.createCourse({ title: "Beta only", slug: "beta-only" });

    expect((await alpha.listCourses()).map((course) => course.slug)).not.toContain("beta-only");
    expect(await alpha.findCourseBySlug("beta-only")).toBeNull();
  });

  it("lets two schools use the same slug", async () => {
    await alpha.createCourse({ title: "Shared", slug: "shared" });

    await expect(beta.createCourse({ title: "Shared", slug: "shared" })).resolves.toMatchObject({ slug: "shared" });
  });

  it("saves an outline and loads it back in order", async () => {
    const course = await alpha.createCourse({ title: "Outlined", slug: "outlined" });
    const outline = {
      sections: [
        { id: randomUUID(), title: "One", lessons: [lesson("1a"), lesson("1b")] },
        { id: randomUUID(), title: "Two", lessons: [lesson("2a")] },
      ],
    };

    expect(await alpha.replaceOutline(course.id, outline)).toBe(true);
    expect(await alpha.findCourseBySlug("outlined")).toEqual({ ...course, sections: asLoaded(outline.sections) });
  });

  it("renames, reorders, moves and removes to match a new outline", async () => {
    const course = await alpha.createCourse({ title: "Edited", slug: "edited" });
    const [one, two, kept, moved, dropped] = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    await alpha.replaceOutline(course.id, {
      sections: [
        { id: one, title: "One", lessons: [lesson("Kept", kept), lesson("Dropped", dropped)] },
        { id: two, title: "Two", lessons: [lesson("Moved", moved)] },
      ],
    });

    // A student's progress on the moved lesson must survive its old section being removed.
    const student = await db.user.create({ data: { email: "edited-student@example.com" } });
    const enrollment = await db.enrollment.create({
      data: { schoolId: alphaSchoolId, userId: student.id, courseId: course.id, source: "manual" },
    });
    await db.lessonProgress.create({ data: { schoolId: alphaSchoolId, enrollmentId: enrollment.id, lessonId: moved } });

    const next = { sections: [{ id: one, title: "One renamed", lessons: [lesson("Moved", moved), lesson("Kept", kept), lesson("New")] }] };
    await alpha.replaceOutline(course.id, next);

    expect((await alpha.findCourseBySlug("edited"))?.sections).toEqual(asLoaded(next.sections));
    expect(await db.lesson.count({ where: { id: { in: [dropped] } } })).toBe(0);
    expect(await db.section.count({ where: { id: two } })).toBe(0);
    expect(await db.lessonProgress.count({ where: { lessonId: moved } })).toBe(1);
  });

  it("saves nothing when an outline reuses an id owned by another school", async () => {
    const theirs = await beta.createCourse({ title: "Theirs", slug: "theirs" });
    const theirLesson = randomUUID();
    await beta.replaceOutline(theirs.id, { sections: [{ id: randomUUID(), title: "S", lessons: [lesson("Theirs", theirLesson)] }] });
    const mine = await alpha.createCourse({ title: "Mine", slug: "mine" });

    const hijack = alpha.replaceOutline(mine.id, {
      sections: [{ id: randomUUID(), title: "S", lessons: [lesson("Mine"), lesson("Hijack", theirLesson)] }],
    });

    await expect(hijack).rejects.toThrow();
    expect((await alpha.findCourseBySlug("mine"))?.sections).toEqual([]);
    expect((await beta.findCourseBySlug("theirs"))?.sections[0]?.lessons[0]?.title).toBe("Theirs");
  });

  it("updates a course's details", async () => {
    const course = await alpha.createCourse({ title: "Draft", slug: "draft" });

    expect(await alpha.updateCourse(course.id, { status: "published", description: "Learn" })).toEqual({
      ...course,
      status: "published",
      description: "Learn",
    });
  });

  it("deletes a course with its outline", async () => {
    const course = await alpha.createCourse({ title: "Doomed", slug: "doomed" });
    const sectionId = randomUUID();
    await alpha.replaceOutline(course.id, { sections: [{ id: sectionId, title: "S", lessons: [lesson("L")] }] });

    expect(await alpha.deleteCourse(course.id)).toBe(true);
    expect(await db.section.count({ where: { id: sectionId } })).toBe(0);
  });

  it("cannot change, delete or outline another school's course", async () => {
    const theirs = await beta.createCourse({ title: "Protected", slug: "protected" });

    expect(await alpha.updateCourse(theirs.id, { title: "Hijacked" })).toBeNull();
    expect(await alpha.deleteCourse(theirs.id)).toBe(false);
    expect(await alpha.replaceOutline(theirs.id, { sections: [] })).toBe(false);
    expect(await beta.findCourseBySlug("protected")).toMatchObject({ title: "Protected" });
  });
});
