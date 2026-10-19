/** A day in milliseconds. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** When a lesson opens: some days after the student enrolled, or on a date; neither opens at once. */
export interface LessonUnlock {
  unlockAfterDays: number | null;
  /** ISO date-time. */
  unlockAt: string | null;
}

/**
 * Works out when a drip lesson opens for one student.
 *
 * @param lesson The lesson's unlock settings.
 * @param enrolledAt When the student enrolled in the course.
 * @returns When it opens, or null when it is open from the start.
 * @example
 * lessonUnlocksAt({ unlockAfterDays: 7, unlockAt: null }, new Date("2026-10-01T09:00:00Z")); // 2026-10-08T09:00:00Z
 */
export function lessonUnlocksAt(lesson: LessonUnlock, enrolledAt: Date): Date | null {
  if (lesson.unlockAt) return new Date(lesson.unlockAt);
  if (lesson.unlockAfterDays !== null) return new Date(enrolledAt.getTime() + lesson.unlockAfterDays * DAY_MS);
  return null;
}

/**
 * Says until when a drip lesson stays closed to a student.
 *
 * @param lesson The lesson's unlock settings.
 * @param enrolledAt When the student enrolled in the course.
 * @param now The current time.
 * @returns When it opens while that is still ahead, or null once it is open.
 * @example
 * lockedUntil({ unlockAfterDays: 7, unlockAt: null }, enrolledAt, now); // a Date, or null after a week
 */
export function lockedUntil(lesson: LessonUnlock, enrolledAt: Date, now: Date): Date | null {
  const opensAt = lessonUnlocksAt(lesson, enrolledAt);
  return opensAt && opensAt > now ? opensAt : null;
}
