import type { DbClient } from "./client";
import { forSchool } from "./tenant";

/**
 * One school's lessons as the media module needs them. Every query goes through the tenant
 * client, so another school's lessons are invisible; it satisfies `LessonMediaStore` from `@reanit/core/media`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school whose lessons these are.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const media = createMediaService({ schoolId, lessons: createLessonMediaStore(db, schoolId), storage, clock, newId });
 */
export function createLessonMediaStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  return {
    /**
     * Finds a lesson with its attached file.
     *
     * @param lessonId The lesson's id.
     * @returns The lesson, or null when the school has none with that id.
     */
    findLesson(lessonId: string) {
      return tenant.lesson.findFirst({ where: { id: lessonId }, select: { id: true, type: true, mediaKey: true } });
    },

    /**
     * Attaches a file to a lesson. A lesson of another school is left untouched.
     *
     * @param lessonId The lesson's id.
     * @param mediaKey The file's storage key.
     */
    async setMediaKey(lessonId: string, mediaKey: string) {
      await tenant.lesson.updateMany({ where: { id: lessonId }, data: { mediaKey } });
    },
  };
}
