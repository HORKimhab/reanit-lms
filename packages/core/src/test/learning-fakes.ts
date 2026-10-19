// In-memory fake of the learning port, for unit tests of the learning service.
import type { Enrollment, LearningStore, LessonProgress, ProgressUpdate } from "../learning";

/** A stored enrollment with its student. */
type FakeEnrollment = Enrollment & { userId: string };

/** In-memory `LearningStore` for one school, whose rows tests can inspect. */
export class FakeLearningStore implements LearningStore {
  readonly enrollments: FakeEnrollment[] = [];
  /** Lesson id → course id, for the school's lessons. */
  readonly lessonCourses = new Map<string, string>();
  /** Progress rows keyed by `<enrollment id>:<lesson id>`. */
  readonly progress = new Map<string, LessonProgress>();
  /** Completions recorded by `completeCourse`, once per enrollment. */
  readonly completions = new Map<string, Date>();

  /**
   * Finds a student's enrollment in a course.
   *
   * @param userId The student.
   * @param courseId The course.
   * @returns The enrollment, or null.
   */
  async findEnrollment(userId: string, courseId: string) {
    const found = this.enrollments.find((enrollment) => enrollment.userId === userId && enrollment.courseId === courseId);
    return found ? { id: found.id, courseId: found.courseId, expiresAt: found.expiresAt } : null;
  }

  /**
   * Finds a student's enrollment in a lesson's course.
   *
   * @param userId The student.
   * @param lessonId The lesson.
   * @returns The enrollment, or null.
   */
  async findEnrollmentForLesson(userId: string, lessonId: string) {
    const courseId = this.lessonCourses.get(lessonId);
    return courseId ? this.findEnrollment(userId, courseId) : null;
  }

  /**
   * Lists an enrollment's progress.
   *
   * @param enrollmentId The enrollment.
   * @returns Its progress rows.
   */
  async listProgress(enrollmentId: string) {
    return [...this.progress].filter(([key]) => key.startsWith(`${enrollmentId}:`)).map(([, entry]) => entry);
  }

  /**
   * Saves progress; a completed lesson stays completed.
   *
   * @param enrollmentId The enrollment.
   * @param lessonId The lesson.
   * @param update The position, completion, or both.
   * @param update.positionSeconds The video position; omitted keeps the saved one.
   * @param update.completed True to mark the lesson completed.
   */
  async saveProgress(enrollmentId: string, lessonId: string, { positionSeconds, completed }: ProgressUpdate) {
    const key = `${enrollmentId}:${lessonId}`;
    const saved = this.progress.get(key) ?? { lessonId, positionSeconds: 0, isCompleted: false };
    this.progress.set(key, {
      lessonId,
      positionSeconds: positionSeconds ?? saved.positionSeconds,
      isCompleted: saved.isCompleted || completed === true,
    });
  }

  /**
   * Counts a course's lessons and the enrollment's completed ones.
   *
   * @param enrollmentId The enrollment.
   * @param courseId The course.
   * @returns Completed and total lessons.
   */
  async countLessons(enrollmentId: string, courseId: string) {
    const lessons = [...this.lessonCourses].filter(([, course]) => course === courseId).map(([lesson]) => lesson);
    const completed = lessons.filter((lesson) => this.progress.get(`${enrollmentId}:${lesson}`)?.isCompleted).length;
    return { completed, total: lessons.length };
  }

  /**
   * Records the course completed, once.
   *
   * @param enrollment The enrollment.
   * @param at When it was completed.
   */
  async completeCourse(enrollment: Enrollment, at: Date) {
    if (!this.completions.has(enrollment.id)) this.completions.set(enrollment.id, at);
  }
}
