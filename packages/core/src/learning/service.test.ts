import { beforeEach, describe, expect, it } from "vitest";

import { CourseNotFoundError, type CourseWithOutline } from "../catalog";
import { LessonMediaMissingError, createMediaService } from "../media";
import { FakeClock } from "../test/auth-fakes";
import { FakeCatalogStore } from "../test/catalog-fakes";
import { FakeLearningStore } from "../test/learning-fakes";
import { FakeLessonMediaStore, FakeObjectStorage } from "../test/media-fakes";
import { NotEnrolledError } from "./errors";
import { createLearningService, type LearningService } from "./service";

const NOW = new Date("2026-10-19T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const STUDENT = "user-1";

/**
 * Builds a course with one section of the given lessons.
 *
 * @param lessonIds Ids of its lessons, in order.
 * @returns The course.
 */
function courseWith(lessonIds: string[]): CourseWithOutline {
  return {
    id: "course-1",
    title: "Brand Design Basics",
    slug: "brand",
    description: null,
    status: "draft",
    sections: [
      {
        id: "section-1",
        title: "Start",
        lessons: lessonIds.map((id) => ({ id, title: id, type: "video" as const, durationSeconds: 60, hasMedia: id === "l1" })),
      },
    ],
  };
}

/**
 * The test's fixed file id; playback never makes one.
 *
 * @returns "id".
 */
function newId() {
  return "id";
}

let store: FakeLearningStore;
let lessonMedia: FakeLessonMediaStore;
let clock: FakeClock;
let learning: LearningService;

beforeEach(() => {
  const catalog = new FakeCatalogStore();
  catalog.courses.push(courseWith(["l1", "l2"]));
  store = new FakeLearningStore();
  store.lessonCourses.set("l1", "course-1").set("l2", "course-1");
  store.enrollments.push({ id: "enrollment-1", userId: STUDENT, courseId: "course-1", expiresAt: null });
  lessonMedia = new FakeLessonMediaStore();
  lessonMedia.lessons.set("l1", { id: "l1", type: "video", mediaKey: "schools/s/lessons/l1/a.mp4" });
  lessonMedia.lessons.set("l2", { id: "l2", type: "video", mediaKey: null });
  clock = new FakeClock(NOW);
  const media = createMediaService({ schoolId: "s", lessons: lessonMedia, storage: new FakeObjectStorage(), clock, newId });
  learning = createLearningService({ catalog, store, media, clock });
});

describe("getCourse", () => {
  it("gives an enrolled student the course, drafts included, with their progress", async () => {
    await store.saveProgress("enrollment-1", "l1", { positionSeconds: 30 });

    const course = await learning.getCourse(STUDENT, "brand");

    expect(course.sections[0]?.lessons.map((lesson) => lesson.id)).toEqual(["l1", "l2"]);
    expect(course.progress).toEqual([{ lessonId: "l1", positionSeconds: 30, isCompleted: false }]);
  });

  it("refuses a student who is not enrolled", async () => {
    await expect(learning.getCourse("user-2", "brand")).rejects.toThrow(NotEnrolledError);
  });

  it("refuses a student whose enrollment has expired", async () => {
    store.enrollments[0] = { id: "enrollment-1", userId: STUDENT, courseId: "course-1", expiresAt: NOW };

    await expect(learning.getCourse(STUDENT, "brand")).rejects.toThrow(NotEnrolledError);
  });

  it("lets a student in until their enrollment expires", async () => {
    store.enrollments[0] = { id: "enrollment-1", userId: STUDENT, courseId: "course-1", expiresAt: new Date(NOW.getTime() + DAY_MS) };

    await expect(learning.getCourse(STUDENT, "brand")).resolves.toMatchObject({ id: "course-1" });
  });

  it("throws CourseNotFoundError for a course the school does not have", async () => {
    await expect(learning.getCourse(STUDENT, "missing")).rejects.toThrow(CourseNotFoundError);
  });
});

describe("getLessonMedia", () => {
  it("signs the lesson's file for an enrolled student", async () => {
    const { url } = await learning.getLessonMedia(STUDENT, "l1");

    expect(url).toContain("schools/s/lessons/l1/a.mp4?download");
  });

  it("refuses a student who is not enrolled", async () => {
    await expect(learning.getLessonMedia("user-2", "l1")).rejects.toThrow(NotEnrolledError);
  });

  it("refuses a lesson outside every enrollment", async () => {
    await expect(learning.getLessonMedia(STUDENT, "other-course-lesson")).rejects.toThrow(NotEnrolledError);
  });

  it("throws LessonMediaMissingError when no file is attached", async () => {
    await expect(learning.getLessonMedia(STUDENT, "l2")).rejects.toThrow(LessonMediaMissingError);
  });
});

describe("recordProgress", () => {
  it("saves a heartbeat's video position", async () => {
    await learning.recordProgress(STUDENT, "l1", { positionSeconds: 45 });

    expect(store.progress.get("enrollment-1:l1")).toEqual({ lessonId: "l1", positionSeconds: 45, isCompleted: false });
    expect(store.completions.size).toBe(0);
  });

  it("completes the course once its last lesson is completed", async () => {
    await learning.recordProgress(STUDENT, "l1", { completed: true });
    expect(store.completions.size).toBe(0);

    await learning.recordProgress(STUDENT, "l2", { completed: true });

    expect(store.completions).toEqual(new Map([["enrollment-1", NOW]]));
  });

  it("refuses a student who is not enrolled and saves nothing", async () => {
    await expect(learning.recordProgress("user-2", "l1", { positionSeconds: 1 })).rejects.toThrow(NotEnrolledError);
    expect(store.progress.size).toBe(0);
  });
});
