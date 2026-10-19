import type { Clock } from "../auth";
import { CourseNotFoundError, type CatalogStore, type CourseWithOutline } from "../catalog";
import type { MediaService } from "../media";
import { NotEnrolledError } from "./errors";
import type { Enrollment, LearningStore, LessonProgress } from "./ports";
import type { ProgressInput } from "./rules";

/** What `createLearningService` needs. */
export interface LearningDependencies {
  /** The school's courses, for the outline the player shows. */
  catalog: Pick<CatalogStore, "findCourseBySlug">;
  store: LearningStore;
  /** Signs URLs to the school's lesson files. */
  media: Pick<MediaService, "getPlaybackUrl">;
  clock: Clock;
}

/** A course as its enrolled student plays it: the outline and the student's progress. */
export type PlayerCourse = CourseWithOutline & { progress: LessonProgress[] };

/**
 * Builds one school's learning use cases: the player's course, lesson files and progress.
 * Every use case first checks that the student holds a current enrollment in the course.
 *
 * @param dependencies Catalog, store, media and clock.
 * @param dependencies.catalog The school's courses.
 * @param dependencies.store The school's enrollments and progress.
 * @param dependencies.media Signs lesson file URLs.
 * @param dependencies.clock Source of the current time.
 * @returns Player, file and progress operations.
 * @example
 * const learning = createLearningService({ catalog: createCatalogStore(db, schoolId), store: createLearningStore(db, schoolId), media, clock });
 */
export function createLearningService({ catalog, store, media, clock }: LearningDependencies) {
  /**
   * Keeps an enrollment only while it gives access.
   *
   * @param enrollment The enrollment found, or null.
   * @returns The enrollment.
   * @throws {NotEnrolledError} When there is none or it has expired.
   */
  function requireCurrent(enrollment: Enrollment | null): Enrollment {
    if (!enrollment || (enrollment.expiresAt && enrollment.expiresAt <= clock.now())) throw new NotEnrolledError();
    return enrollment;
  }

  /**
   * Finds the student's current enrollment in the course a lesson belongs to.
   *
   * @param userId The student.
   * @param lessonId The lesson.
   * @returns The enrollment.
   * @throws {NotEnrolledError} When the student cannot open the lesson.
   */
  async function requireLessonAccess(userId: string, lessonId: string): Promise<Enrollment> {
    return requireCurrent(await store.findEnrollmentForLesson(userId, lessonId));
  }

  return {
    /**
     * Loads a course for its enrolled student, drafts included: a student keeps a course they have.
     *
     * @param userId The student.
     * @param slug The course's slug.
     * @returns The course with its outline and the student's progress.
     * @throws {CourseNotFoundError} When the school has no such course.
     * @throws {NotEnrolledError} When the student has no current enrollment in it.
     */
    async getCourse(userId: string, slug: string): Promise<PlayerCourse> {
      const course = await catalog.findCourseBySlug(slug);
      if (!course) throw new CourseNotFoundError();
      const enrollment = requireCurrent(await store.findEnrollment(userId, course.id));
      return { ...course, progress: await store.listProgress(enrollment.id) };
    },

    /**
     * Signs a URL to a lesson's video or PDF for its enrolled student.
     *
     * @param userId The student.
     * @param lessonId The lesson.
     * @returns The URL and when it expires.
     * @throws {NotEnrolledError} When the student cannot open the lesson.
     * @throws {LessonMediaMissingError} When no file is attached.
     */
    async getLessonMedia(userId: string, lessonId: string) {
      await requireLessonAccess(userId, lessonId);
      return media.getPlaybackUrl(lessonId);
    },

    /**
     * Saves a heartbeat or a completed lesson; completing the last lesson completes the course, once.
     *
     * @param userId The student.
     * @param lessonId The lesson.
     * @param input The video position, completion, or both.
     * @throws {NotEnrolledError} When the student cannot open the lesson.
     */
    async recordProgress(userId: string, lessonId: string, input: ProgressInput): Promise<void> {
      const enrollment = await requireLessonAccess(userId, lessonId);
      await store.saveProgress(enrollment.id, lessonId, input);
      if (!input.completed) return;
      const { completed, total } = await store.countLessons(enrollment.id, enrollment.courseId);
      if (completed >= total) await store.completeCourse(enrollment, clock.now());
    },
  };
}

/** One school's learning use cases. */
export type LearningService = ReturnType<typeof createLearningService>;
