// A course and a quiz as the player API returns them for their enrolled student, for player component and page tests.
import { playerLessons, type PlayerCourse } from "@reanit/core/learning";

import type { StudentQuizView } from "@/server/learning/quizzes";

import { PUBLISHED_COURSE_WITH_OUTLINE, SITE_SCHOOL } from "./site";

/** The published course with the student's progress: Welcome completed, Sketching half watched. */
export const PLAYER_COURSE: PlayerCourse = {
  enrolledAt: new Date("2026-09-01T00:00:00Z"),
  ...PUBLISHED_COURSE_WITH_OUTLINE,
  progress: [
    { lessonId: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a02", positionSeconds: 300, isCompleted: true },
    { lessonId: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a05", positionSeconds: 120, isCompleted: false },
  ],
};

/** Its lessons in order: Welcome (video), Workbook (PDF, no file yet), Sketching (video). */
export const PLAYER_LESSONS = playerLessons(PLAYER_COURSE, PLAYER_COURSE.progress, new Date("2026-10-01T00:00:00Z"));

/** The course's player path. */
export const PLAYER_BASE = `/s/${SITE_SCHOOL.slug}/learn/${PLAYER_COURSE.slug}`;

/** A one-question quiz as its student takes it, never tried. */
export const STUDENT_QUIZ: StudentQuizView = {
  passPercent: 100,
  questions: [
    {
      id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a61",
      prompt: "Which color is primary?",
      kind: "single",
      options: [
        { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a62", text: "Red" },
        { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a63", text: "Green" },
      ],
    },
  ],
  lastAttempt: null,
};
