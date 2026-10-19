import { beforeEach, describe, expect, it } from "vitest";

import { CourseNotFoundError, type CourseWithOutline } from "../catalog";
import { LessonMediaMissingError, createMediaService } from "../media";
import { FakeClock } from "../test/auth-fakes";
import { FakeCatalogStore } from "../test/catalog-fakes";
import { FakeLearningStore, FakeQuizStore } from "../test/learning-fakes";
import { FakeLessonMediaStore, FakeObjectStorage } from "../test/media-fakes";
import { LessonLockedError, NotEnrolledError, QuizNotFoundError } from "./errors";
import type { Quiz } from "./quizzes";
import { createLearningService, type LearningService } from "./service";

const NOW = new Date("2026-10-19T00:00:00Z");
const ENROLLED_AT = new Date("2026-10-01T00:00:00Z");
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
        lessons: lessonIds.map((id) => ({ id, title: id, type: "video" as const, durationSeconds: 60, hasMedia: id === "l1", unlockAfterDays: null, unlockAt: null })),
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
let quizzes: FakeQuizStore;
let lessonMedia: FakeLessonMediaStore;
let clock: FakeClock;
let learning: LearningService;

beforeEach(() => {
  const catalog = new FakeCatalogStore();
  catalog.courses.push(courseWith(["l1", "l2"]));
  store = new FakeLearningStore();
  store.lessonCourses.set("l1", "course-1").set("l2", "course-1");
  store.enrollments.push({ id: "enrollment-1", userId: STUDENT, courseId: "course-1", expiresAt: null, enrolledAt: ENROLLED_AT });
  lessonMedia = new FakeLessonMediaStore();
  lessonMedia.lessons.set("l1", { id: "l1", type: "video", mediaKey: "schools/s/lessons/l1/a.mp4" });
  lessonMedia.lessons.set("l2", { id: "l2", type: "video", mediaKey: null });
  clock = new FakeClock(NOW);
  const media = createMediaService({ schoolId: "s", lessons: lessonMedia, storage: new FakeObjectStorage(), clock, newId });
  quizzes = new FakeQuizStore();
  learning = createLearningService({ catalog, store, quizzes, media, clock });
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
    store.enrollments[0] = { id: "enrollment-1", userId: STUDENT, courseId: "course-1", expiresAt: NOW, enrolledAt: ENROLLED_AT };

    await expect(learning.getCourse(STUDENT, "brand")).rejects.toThrow(NotEnrolledError);
  });

  it("lets a student in until their enrollment expires", async () => {
    store.enrollments[0] = { id: "enrollment-1", userId: STUDENT, courseId: "course-1", expiresAt: new Date(NOW.getTime() + DAY_MS), enrolledAt: ENROLLED_AT };

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

describe("quizzes", () => {
  const Q1 = "0b9a6d1e-5c3f-4a2b-9e8d-7c6b5a4f3e01";
  const RIGHT = "0b9a6d1e-5c3f-4a2b-9e8d-7c6b5a4f3e02";
  const WRONG = "0b9a6d1e-5c3f-4a2b-9e8d-7c6b5a4f3e03";
  const QUIZ: Quiz = {
    passPercent: 100,
    questions: [
      {
        id: Q1,
        prompt: "Which is a primary color?",
        kind: "single",
        options: [
          { id: RIGHT, text: "Red", isCorrect: true },
          { id: WRONG, text: "Green", isCorrect: false },
        ],
      },
    ],
  };

  beforeEach(() => {
    quizzes.lessonTypes.set("l1", "video").set("l2", "quiz");
  });

  it("gives staff a quiz lesson never saved with no questions and the default pass mark", async () => {
    expect(await learning.getQuizForEditing("l2")).toEqual({ passPercent: 70, questions: [] });
  });

  it("saves a quiz on a quiz lesson and refuses any other lesson", async () => {
    await learning.saveQuiz("l2", QUIZ);

    expect(await learning.getQuizForEditing("l2")).toEqual(QUIZ);
    await expect(learning.saveQuiz("l1", QUIZ)).rejects.toThrow(QuizNotFoundError);
    await expect(learning.getQuizForEditing("missing")).rejects.toThrow(QuizNotFoundError);
  });

  it("shows the student the quiz without its right answers, and their last attempt", async () => {
    await learning.saveQuiz("l2", QUIZ);

    const before = await learning.getQuiz(STUDENT, "l2");
    await learning.submitQuiz(STUDENT, "l2", [{ questionId: Q1, optionIds: [WRONG] }]);

    expect(before).toEqual({
      passPercent: 100,
      questions: [{ id: Q1, prompt: "Which is a primary color?", kind: "single", options: [{ id: RIGHT, text: "Red" }, { id: WRONG, text: "Green" }] }],
      lastAttempt: null,
    });
    expect((await learning.getQuiz(STUDENT, "l2")).lastAttempt).toEqual({ scorePercent: 0, isPassed: false, at: NOW });
  });

  it("keeps a failed attempt without completing the lesson", async () => {
    await learning.saveQuiz("l2", QUIZ);

    expect(await learning.submitQuiz(STUDENT, "l2", [])).toEqual({ scorePercent: 0, isPassed: false, questions: [{ questionId: Q1, isCorrect: false }] });
    expect(quizzes.attempts).toHaveLength(1);
    expect(store.progress.size).toBe(0);
  });

  it("completes the lesson, and the course after its last lesson, when the student passes", async () => {
    await learning.saveQuiz("l2", QUIZ);
    await learning.recordProgress(STUDENT, "l1", { completed: true });

    expect((await learning.submitQuiz(STUDENT, "l2", [{ questionId: Q1, optionIds: [RIGHT] }])).isPassed).toBe(true);
    expect(store.progress.get("enrollment-1:l2")?.isCompleted).toBe(true);
    expect(store.completions).toEqual(new Map([["enrollment-1", NOW]]));
  });

  it("refuses a student who is not enrolled, and a quiz with no questions yet", async () => {
    await learning.saveQuiz("l2", { passPercent: 70, questions: [] });

    await expect(learning.getQuiz("user-2", "l2")).rejects.toThrow(NotEnrolledError);
    await expect(learning.getQuiz(STUDENT, "l2")).rejects.toThrow(QuizNotFoundError);
    await expect(learning.submitQuiz(STUDENT, "l2", [])).rejects.toThrow(QuizNotFoundError);
    expect(quizzes.attempts).toEqual([]);
  });
});

describe("drip lessons", () => {
  it("gives the player when the student enrolled, so it can show when lessons open", async () => {
    expect((await learning.getCourse(STUDENT, "brand")).enrolledAt).toEqual(ENROLLED_AT);
  });

  it("keeps a lesson closed until its days after enrollment have passed, then opens it", async () => {
    // Enrolled 18 days before NOW.
    store.lessonUnlocks.set("l1", { unlockAfterDays: 19, unlockAt: null });

    const locked = learning.recordProgress(STUDENT, "l1", { positionSeconds: 1 });

    await expect(locked).rejects.toThrow(LessonLockedError);
    await expect(locked).rejects.toMatchObject({ unlocksAt: new Date("2026-10-20T00:00:00Z") });
    expect(store.progress.size).toBe(0);
    store.lessonUnlocks.set("l1", { unlockAfterDays: 18, unlockAt: null });
    await expect(learning.recordProgress(STUDENT, "l1", { positionSeconds: 1 })).resolves.toBeUndefined();
  });

  it("keeps a lesson closed until its date, for its file too", async () => {
    store.lessonUnlocks.set("l1", { unlockAfterDays: null, unlockAt: new Date(NOW.getTime() + 1).toISOString() });

    await expect(learning.getLessonMedia(STUDENT, "l1")).rejects.toThrow(LessonLockedError);
    store.lessonUnlocks.set("l1", { unlockAfterDays: null, unlockAt: NOW.toISOString() });
    await expect(learning.getLessonMedia(STUDENT, "l1")).resolves.toMatchObject({ url: expect.any(String) });
  });
});
