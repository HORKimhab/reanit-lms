import { z } from "zod";

import type { CourseWithOutline } from "../catalog";
import { lockedUntil } from "./drip";
import type { LessonProgress } from "./ports";

/** Longest video position accepted: no lesson runs a day. */
const MAX_POSITION_SECONDS = 24 * 60 * 60;
const PERCENT = 100;

/** A heartbeat (`positionSeconds`) or "complete" (`completed: true`) from the player; at least one is sent. */
export const progressSchema = z
  .object({
    positionSeconds: z.number().int().min(0).max(MAX_POSITION_SECONDS),
    completed: z.literal(true),
  })
  .partial()
  .refine(({ positionSeconds, completed }) => positionSeconds !== undefined || completed !== undefined, {
    message: "Send positionSeconds, completed or both",
  });

/** Parsed progress input. */
export type ProgressInput = z.infer<typeof progressSchema>;

/** A lesson as the player lists it: in course order, with its section and the student's progress. */
export type PlayerLesson = CourseWithOutline["sections"][number]["lessons"][number] & {
  /** Position in the whole course, from 0. */
  index: number;
  sectionId: string;
  sectionTitle: string;
  positionSeconds: number;
  isCompleted: boolean;
  /** When a drip lesson opens for the student while it is still closed; null once open. */
  lockedUntil: Date | null;
};

/** How far a student is through a course. */
export interface ProgressSummary {
  completed: number;
  total: number;
  /** 0 to 100, rounded. */
  percent: number;
  /** Where the player resumes: the first lesson not completed, or the last one when all are; undefined for an empty course. */
  resume: PlayerLesson | undefined;
}

/**
 * Lists a course's lessons in order with the student's progress on each, and until when each drip
 * lesson stays closed to them.
 *
 * @param course The course with its outline and when the student enrolled.
 * @param progress The student's saved progress; lessons without any are not started.
 * @param now The current time, for drip lessons.
 * @returns The lessons, flattened across sections.
 * @example
 * playerLessons(course, [{ lessonId: "l1", positionSeconds: 0, isCompleted: true }], new Date())[0].isCompleted; // true
 */
export function playerLessons(course: Pick<CourseWithOutline, "sections"> & { enrolledAt: Date }, progress: readonly LessonProgress[], now: Date): PlayerLesson[] {
  const byLesson = new Map(progress.map((entry) => [entry.lessonId, entry]));
  return course.sections
    .flatMap((section) => section.lessons.map((lesson) => ({ ...lesson, sectionId: section.id, sectionTitle: section.title })))
    .map((lesson, index) => {
      const saved = byLesson.get(lesson.id);
      return {
        ...lesson,
        index,
        positionSeconds: saved?.positionSeconds ?? 0,
        isCompleted: saved?.isCompleted ?? false,
        lockedUntil: lockedUntil(lesson, course.enrolledAt, now),
      };
    });
}

/**
 * Sums up a student's progress through a course.
 *
 * @param lessons The course's lessons from `playerLessons`.
 * @returns Completed and total lessons, the percent done and the lesson to resume.
 * @example
 * summarizeProgress(lessons); // { completed: 4, total: 9, percent: 44, resume: lessons[4] }
 */
export function summarizeProgress(lessons: readonly PlayerLesson[]): ProgressSummary {
  const completed = lessons.filter((lesson) => lesson.isCompleted).length;
  return {
    completed,
    total: lessons.length,
    percent: lessons.length === 0 ? 0 : Math.round((completed / lessons.length) * PERCENT),
    resume: lessons.find((lesson) => !lesson.isCompleted) ?? lessons.at(-1),
  };
}
