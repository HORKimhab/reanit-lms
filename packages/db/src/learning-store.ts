import type { DbClient } from "./client";
import { recordCompletion } from "./daily-stats";
import { forSchool, inSchoolTransaction } from "./tenant";

const ENROLLMENT_FIELDS = { id: true, courseId: true, expiresAt: true } as const;

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
    findEnrollment(userId: string, courseId: string) {
      return tenant.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: ENROLLMENT_FIELDS });
    },

    /**
     * Finds a student's enrollment in the course a lesson belongs to.
     *
     * @param userId The student.
     * @param lessonId The lesson.
     * @returns The enrollment, or null when there is none or the school has no such lesson.
     */
    findEnrollmentForLesson(userId: string, lessonId: string) {
      return tenant.enrollment.findFirst({
        where: { userId, course: { sections: { some: { lessons: { some: { id: lessonId } } } } } },
        select: ENROLLMENT_FIELDS,
      });
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
     * Marks the enrollment's course completed and counts it in the day's completions, once.
     *
     * @param enrollment The enrollment.
     * @param enrollment.id Its id.
     * @param enrollment.courseId Its course.
     * @param at When it was completed.
     */
    async completeCourse({ id, courseId }: { id: string; courseId: string }, at: Date) {
      await inSchoolTransaction(db, schoolId, async (tx) => {
        const { count } = await tx.enrollment.updateMany({ where: { id, completedAt: null }, data: { completedAt: at } });
        if (count > 0) await recordCompletion(tx, { schoolId, courseId, at });
      });
    },
  };
}
