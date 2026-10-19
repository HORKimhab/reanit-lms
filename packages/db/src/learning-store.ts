import type { DbClient } from "./client";
import { recordCompletion } from "./daily-stats";
import { appendEvent } from "./outbox";
import { forSchool, inSchoolTransaction } from "./tenant";

const ENROLLMENT_FIELDS = { id: true, courseId: true, expiresAt: true, createdAt: true } as const;

/**
 * Names an enrollment's creation time as the learning module reads it: when the student enrolled.
 *
 * @param enrollment A stored enrollment, or null.
 * @param enrollment.id Its id.
 * @param enrollment.courseId Its course.
 * @param enrollment.expiresAt When access ends, or null.
 * @param enrollment.createdAt When it was made.
 * @returns The enrollment with `enrolledAt`, or null.
 */
function toEnrollment(enrollment: { id: string; courseId: string; expiresAt: Date | null; createdAt: Date } | null) {
  return enrollment && { id: enrollment.id, courseId: enrollment.courseId, expiresAt: enrollment.expiresAt, enrolledAt: enrollment.createdAt };
}

/**
 * One school's enrollments and lesson progress. Every query goes through the tenant client, so
 * another school's rows are invisible; it satisfies `LearningStore` from `@reanit/core/learning`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school whose students these are.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const learning = createLearningService({ catalog, store: createLearningStore(db, school.id), media, clock });
 */
export function createLearningStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  return {
    /**
     * Finds a student's enrollment in a course.
     *
     * @param userId The student.
     * @param courseId The course.
     * @returns The enrollment, or null.
     */
    async findEnrollment(userId: string, courseId: string) {
      return toEnrollment(await tenant.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: ENROLLMENT_FIELDS }));
    },

    /**
     * Finds a student's enrollment in the course a lesson belongs to.
     *
     * @param userId The student.
     * @param lessonId The lesson.
     * @returns The enrollment, or null when there is none or the school has no such lesson.
     */
    async findEnrollmentForLesson(userId: string, lessonId: string) {
      return toEnrollment(
        await tenant.enrollment.findFirst({
          where: { userId, course: { sections: { some: { lessons: { some: { id: lessonId } } } } } },
          select: ENROLLMENT_FIELDS,
        }),
      );
    },

    /**
     * Reads a lesson's drip settings.
     *
     * @param lessonId The lesson.
     * @returns When it opens, or null when the school has no such lesson.
     */
    async findLessonUnlock(lessonId: string) {
      const lesson = await tenant.lesson.findFirst({ where: { id: lessonId }, select: { unlockAfterDays: true, unlockAt: true } });
      return lesson && { unlockAfterDays: lesson.unlockAfterDays, unlockAt: lesson.unlockAt?.toISOString() ?? null };
    },

    /**
     * Lists an enrollment's lesson progress.
     *
     * @param enrollmentId The enrollment.
     * @returns One entry per lesson the student has opened.
     */
    async listProgress(enrollmentId: string) {
      const rows = await tenant.lessonProgress.findMany({
        where: { enrollmentId },
        select: { lessonId: true, videoPositionSeconds: true, completedAt: true },
      });
      return rows.map((row) => ({ lessonId: row.lessonId, positionSeconds: row.videoPositionSeconds, isCompleted: row.completedAt !== null }));
    },

    /**
     * Saves a lesson's video position and/or completion. A completed lesson keeps its first completion time.
     *
     * @param enrollmentId The enrollment.
     * @param lessonId The lesson.
     * @param update What to save.
     * @param update.positionSeconds The video position; omitted keeps the saved one.
     * @param update.completed True to mark the lesson completed.
     */
    async saveProgress(enrollmentId: string, lessonId: string, { positionSeconds, completed }: { positionSeconds?: number; completed?: boolean }) {
      const now = new Date();
      await inSchoolTransaction(db, schoolId, async (tx) => {
        await tx.lessonProgress.upsert({
          where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
          create: { schoolId, enrollmentId, lessonId, videoPositionSeconds: positionSeconds ?? 0, completedAt: completed ? now : null },
          update: positionSeconds === undefined ? {} : { videoPositionSeconds: positionSeconds },
        });
        if (completed) await tx.lessonProgress.updateMany({ where: { enrollmentId, lessonId, completedAt: null }, data: { completedAt: now } });
      });
    },

    /**
     * Counts a course's lessons and how many the enrollment completed.
     *
     * @param enrollmentId The enrollment.
     * @param courseId The course.
     * @returns Completed and total lessons.
     */
    async countLessons(enrollmentId: string, courseId: string) {
      const inCourse = { section: { courseId } };
      const [total, completed] = await Promise.all([
        tenant.lesson.count({ where: inCourse }),
        tenant.lessonProgress.count({ where: { enrollmentId, completedAt: { not: null }, lesson: inCourse } }),
      ]);
      return { completed, total };
    },

    /**
     * Marks the enrollment's course completed, counts it in the day's completions and records
     * `CourseCompleted` in the outbox, once.
     *
     * @param enrollment The enrollment.
     * @param enrollment.id Its id.
     * @param enrollment.courseId Its course.
     * @param at When it was completed.
     */
    async completeCourse({ id, courseId }: { id: string; courseId: string }, at: Date) {
      await inSchoolTransaction(db, schoolId, async (tx) => {
        const { count } = await tx.enrollment.updateMany({ where: { id, completedAt: null }, data: { completedAt: at } });
        if (count === 0) return;
        await recordCompletion(tx, { schoolId, courseId, at });
        await appendEvent(tx, { type: "CourseCompleted", schoolId, payload: { enrollmentId: id, courseId } });
      });
    },
  };
}
