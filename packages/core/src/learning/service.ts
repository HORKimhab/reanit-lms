import type { Clock } from "../auth";
import { CourseNotFoundError, type CatalogStore, type CourseWithOutline } from "../catalog";
import type { MediaService } from "../media";
import { lockedUntil } from "./drip";
import { LessonLockedError, NotEnrolledError, QuizNotFoundError } from "./errors";
import type { Enrollment, LearningStore, LessonProgress, QuizAttemptSummary, QuizStore } from "./ports";
import { DEFAULT_PASS_PERCENT, gradeQuiz, toStudentQuiz, type Quiz, type QuizAnswers, type QuizResult, type StudentQuiz } from "./quizzes";
import type { ProgressInput } from "./rules";

/** What `createLearningService` needs. */
export interface LearningDependencies {
  /** The school's courses, for the outline the player shows. */
  catalog: Pick<CatalogStore, "findCourseBySlug">;
  store: LearningStore;
  /** The school's quizzes and attempts. */
  quizzes: QuizStore;
  /** Signs URLs to the school's lesson files. */
  media: Pick<MediaService, "getPlaybackUrl">;
  clock: Clock;
}

/** A course as its enrolled student plays it: the outline, the student's progress, and when they enrolled (drip lessons count from it). */
export type PlayerCourse = CourseWithOutline & { progress: LessonProgress[]; enrolledAt: Date };

/**
 * Builds one school's learning use cases: the player's course, lesson files, progress and quizzes.
 * Every student use case first checks that the student holds a current enrollment in the course.
 *
 * @param dependencies Catalog, stores, media and clock.
 * @param dependencies.catalog The school's courses.
 * @param dependencies.store The school's enrollments and progress.
 * @param dependencies.quizzes The school's quizzes and attempts.
 * @param dependencies.media Signs lesson file URLs.
 * @param dependencies.clock Source of the current time.
 * @returns Player, file, progress and quiz operations.
 * @example
 * const learning = createLearningService({ catalog: createCatalogStore(db, schoolId), store: createLearningStore(db, schoolId), quizzes, media, clock });
 */
export function createLearningService({ catalog, store, quizzes, media, clock }: LearningDependencies) {
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
   * Finds the student's current enrollment in the course a lesson belongs to, once the lesson is open to them.
   *
   * @param userId The student.
   * @param lessonId The lesson.
   * @returns The enrollment.
   * @throws {NotEnrolledError} When the student cannot open the lesson.
   * @throws {LessonLockedError} When it is a drip lesson that has not opened for them yet.
   */
  async function requireLessonAccess(userId: string, lessonId: string): Promise<Enrollment> {
    const enrollment = requireCurrent(await store.findEnrollmentForLesson(userId, lessonId));
    const unlock = await store.findLessonUnlock(lessonId);
    const opensAt = unlock && lockedUntil(unlock, enrollment.enrolledAt, clock.now());
    if (opensAt) throw new LessonLockedError(opensAt);
    return enrollment;
  }

  /**
   * Completes the course once every lesson is completed; a repeat changes nothing.
   *
   * @param enrollment The student's enrollment, after a lesson was completed.
   */
  async function completeCourseWhenDone(enrollment: Enrollment): Promise<void> {
    const { completed, total } = await store.countLessons(enrollment.id, enrollment.courseId);
    if (completed >= total) await store.completeCourse(enrollment, clock.now());
  }

  /**
   * Checks that a lesson is one of the school's quizzes.
   *
   * @param lessonId The lesson.
   * @throws {QuizNotFoundError} When the school has no such lesson or it is not a quiz.
   */
  async function requireQuizLesson(lessonId: string): Promise<void> {
    if ((await quizzes.findLessonType(lessonId)) !== "quiz") throw new QuizNotFoundError();
  }

  /**
   * Loads a quiz a student can take: the lesson must be a quiz with questions.
   *
   * @param lessonId The lesson.
   * @returns The quiz with its right answers.
   * @throws {QuizNotFoundError} When the lesson has no quiz yet.
   */
  async function requireQuiz(lessonId: string): Promise<Quiz> {
    const quiz = await quizzes.findQuiz(lessonId);
    if (!quiz || quiz.questions.length === 0) throw new QuizNotFoundError();
    return quiz;
  }

  return {
    /**
     * Loads a course for its enrolled student, drafts included: a student keeps a course they have.
     *
     * @param userId The student.
     * @param slug The course's slug.
     * @returns The course with its outline, the student's progress and when they enrolled.
     * @throws {CourseNotFoundError} When the school has no such course.
     * @throws {NotEnrolledError} When the student has no current enrollment in it.
     */
    async getCourse(userId: string, slug: string): Promise<PlayerCourse> {
      const course = await catalog.findCourseBySlug(slug);
      if (!course) throw new CourseNotFoundError();
      const enrollment = requireCurrent(await store.findEnrollment(userId, course.id));
      return { ...course, progress: await store.listProgress(enrollment.id), enrolledAt: enrollment.enrolledAt };
    },

    /**
     * Signs a URL to a lesson's video or PDF for its enrolled student.
     *
     * @param userId The student.
     * @param lessonId The lesson.
     * @returns The URL and when it expires.
     * @throws {NotEnrolledError} When the student cannot open the lesson.
     * @throws {LessonLockedError} When the drip lesson has not opened yet.
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
     * @throws {LessonLockedError} When the drip lesson has not opened yet.
     */
    async recordProgress(userId: string, lessonId: string, input: ProgressInput): Promise<void> {
      const enrollment = await requireLessonAccess(userId, lessonId);
      await store.saveProgress(enrollment.id, lessonId, input);
      if (input.completed) await completeCourseWhenDone(enrollment);
    },

    /**
     * Loads a quiz lesson for the builder, with its right answers; a quiz never saved has no questions yet.
     *
     * @param lessonId The lesson.
     * @returns The quiz.
     * @throws {QuizNotFoundError} When the school has no such lesson or it is not a quiz.
     */
    async getQuizForEditing(lessonId: string): Promise<Quiz> {
      await requireQuizLesson(lessonId);
      return (await quizzes.findQuiz(lessonId)) ?? { passPercent: DEFAULT_PASS_PERCENT, questions: [] };
    },

    /**
     * Saves a quiz lesson's pass mark and questions; earlier attempts keep their scores.
     *
     * @param lessonId The lesson.
     * @param quiz The pass mark and questions.
     * @throws {QuizNotFoundError} When the school has no such lesson or it is not a quiz.
     */
    async saveQuiz(lessonId: string, quiz: Quiz): Promise<void> {
      await requireQuizLesson(lessonId);
      await quizzes.saveQuiz(lessonId, quiz);
    },

    /**
     * Loads a quiz for its enrolled student, without the right answers, with how their last attempt went.
     *
     * @param userId The student.
     * @param lessonId The quiz lesson.
     * @returns The quiz and the student's last attempt, or null before the first.
     * @throws {NotEnrolledError} When the student cannot open the lesson.
     * @throws {LessonLockedError} When the drip lesson has not opened yet.
     * @throws {QuizNotFoundError} When the lesson has no quiz yet.
     */
    async getQuiz(userId: string, lessonId: string): Promise<StudentQuiz & { lastAttempt: QuizAttemptSummary | null }> {
      const enrollment = await requireLessonAccess(userId, lessonId);
      const quiz = await requireQuiz(lessonId);
      return { ...toStudentQuiz(quiz), lastAttempt: await quizzes.findLastAttempt(enrollment.id, lessonId) };
    },

    /**
     * Grades a student's attempt and keeps it; passing completes the lesson, as "complete" does for other lessons.
     *
     * @param userId The student.
     * @param lessonId The quiz lesson.
     * @param answers The options picked per question.
     * @returns The score, whether it passed, and which questions were right.
     * @throws {NotEnrolledError} When the student cannot open the lesson.
     * @throws {LessonLockedError} When the drip lesson has not opened yet.
     * @throws {QuizNotFoundError} When the lesson has no quiz yet.
     */
    async submitQuiz(userId: string, lessonId: string, answers: QuizAnswers): Promise<QuizResult> {
      const enrollment = await requireLessonAccess(userId, lessonId);
      const result = gradeQuiz(await requireQuiz(lessonId), answers);
      await quizzes.recordAttempt({ enrollmentId: enrollment.id, lessonId, answers, result, at: clock.now() });
      if (result.isPassed) {
        await store.saveProgress(enrollment.id, lessonId, { completed: true });
        await completeCourseWhenDone(enrollment);
      }
      return result;
    },
  };
}

/** One school's learning use cases. */
export type LearningService = ReturnType<typeof createLearningService>;
