// In-memory fakes of the learning ports, for unit tests of the learning service.
import type { LessonType } from "../catalog";
import type {
  CommentStore,
  Enrollment,
  InboxThread,
  LearningStore,
  LessonComment,
  LessonProgress,
  LessonUnlock,
  ProgressUpdate,
  Quiz,
  QuizAnswers,
  QuizResult,
  QuizStore,
} from "../learning";

/** A stored enrollment with its student. */
type FakeEnrollment = Enrollment & { userId: string };

/** In-memory `LearningStore` for one school, whose rows tests can inspect. */
export class FakeLearningStore implements LearningStore {
  readonly enrollments: FakeEnrollment[] = [];
  /** Lesson id → course id, for the school's lessons. */
  readonly lessonCourses = new Map<string, string>();
  /** Lesson id → drip settings; lessons missing here open at once. */
  readonly lessonUnlocks = new Map<string, LessonUnlock>();
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
    return found ? { id: found.id, courseId: found.courseId, expiresAt: found.expiresAt, enrolledAt: found.enrolledAt } : null;
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
   * Reads a lesson's drip settings.
   *
   * @param lessonId The lesson.
   * @returns Its settings, opening at once when none were set, or null for an unknown lesson.
   */
  async findLessonUnlock(lessonId: string) {
    if (!this.lessonCourses.has(lessonId)) return null;
    return this.lessonUnlocks.get(lessonId) ?? { unlockAfterDays: null, unlockAt: null };
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

/** In-memory `QuizStore` for one school: lesson types, saved quizzes and every attempt, which tests can inspect. */
export class FakeQuizStore implements QuizStore {
  readonly lessonTypes = new Map<string, LessonType>();
  readonly quizzes = new Map<string, Quiz>();
  readonly attempts: { enrollmentId: string; lessonId: string; answers: QuizAnswers; result: QuizResult; at: Date }[] = [];

  /**
   * Reads a lesson's type.
   *
   * @param lessonId The lesson.
   * @returns Its type, or null when unknown.
   */
  async findLessonType(lessonId: string) {
    return this.lessonTypes.get(lessonId) ?? null;
  }

  /**
   * Reads a lesson's quiz.
   *
   * @param lessonId The lesson.
   * @returns The quiz, or null before it is saved.
   */
  async findQuiz(lessonId: string) {
    return this.quizzes.get(lessonId) ?? null;
  }

  /**
   * Saves a lesson's quiz.
   *
   * @param lessonId The lesson.
   * @param quiz The quiz.
   */
  async saveQuiz(lessonId: string, quiz: Quiz) {
    this.quizzes.set(lessonId, quiz);
  }

  /**
   * Keeps an attempt.
   *
   * @param attempt The attempt.
   */
  async recordAttempt(attempt: FakeQuizStore["attempts"][number]) {
    this.attempts.push(attempt);
  }

  /**
   * Finds an enrollment's latest attempt at a quiz.
   *
   * @param enrollmentId The enrollment.
   * @param lessonId The quiz lesson.
   * @returns Its score, result and time, or null.
   */
  async findLastAttempt(enrollmentId: string, lessonId: string) {
    const last = this.attempts.filter((attempt) => attempt.enrollmentId === enrollmentId && attempt.lessonId === lessonId).at(-1);
    return last ? { scorePercent: last.result.scorePercent, isPassed: last.result.isPassed, at: last.at } : null;
  }
}

/** A stored comment: its place in a thread and who wrote it. */
type FakeComment = LessonComment & { lessonId: string; parentId: string | null; authorId: string };

/** In-memory `CommentStore` for one school; staff ids are the authors shown as staff. */
export class FakeCommentStore implements CommentStore {
  readonly comments: FakeComment[] = [];
  /** Users who are staff of the school. */
  readonly staffIds = new Set<string>();

  /**
   * Shapes a stored comment as the store returns it.
   *
   * @param comment The stored comment.
   * @param comment.id Its id.
   * @param comment.body Its text.
   * @param comment.isHidden Whether staff hid it.
   * @param comment.createdAt When it was written.
   * @param comment.authorId Who wrote it.
   * @returns The comment with its author.
   */
  private view({ id, body, isHidden, createdAt, authorId }: FakeComment): LessonComment {
    return { id, body, isHidden, createdAt, author: { id: authorId, name: authorId, isStaff: this.staffIds.has(authorId) } };
  }

  /**
   * Builds the threads among some comments.
   *
   * @param roots The threads' first comments, newest first.
   * @param includeHidden Whether hidden replies are kept.
   * @returns The threads with their replies, oldest first.
   */
  private threads(roots: FakeComment[], includeHidden: boolean) {
    return roots.map((root) => ({
      ...this.view(root),
      lessonId: root.lessonId,
      replies: this.comments.filter((reply) => reply.parentId === root.id && (includeHidden || !reply.isHidden)).map((reply) => this.view(reply)),
    }));
  }

  /**
   * Lists a lesson's threads.
   *
   * @param lessonId The lesson.
   * @param options Whether hidden comments are included.
   * @param options.includeHidden True for staff.
   * @returns The threads, newest first.
   */
  async listThreads(lessonId: string, { includeHidden }: { includeHidden: boolean }) {
    const roots = this.comments.filter((comment) => comment.lessonId === lessonId && comment.parentId === null && (includeHidden || !comment.isHidden));
    return this.threads(roots.reverse(), includeHidden);
  }

  /**
   * Finds a comment's place.
   *
   * @param commentId The comment.
   * @returns Its lesson, author and thread, or null.
   */
  async findComment(commentId: string) {
    const comment = this.comments.find(({ id }) => id === commentId);
    return comment ? { id: comment.id, lessonId: comment.lessonId, authorId: comment.authorId, parentId: comment.parentId } : null;
  }

  /**
   * Stores a comment with a sequential id.
   *
   * @param comment The comment.
   * @param comment.lessonId Its lesson.
   * @param comment.authorId Its author.
   * @param comment.parentId Its thread, or null for a new one.
   * @param comment.body Its text.
   * @param comment.at When it was written.
   * @returns The comment.
   */
  async createComment({ lessonId, authorId, parentId, body, at }: { lessonId: string; authorId: string; parentId: string | null; body: string; at: Date }) {
    const comment: FakeComment = { id: `comment-${this.comments.length + 1}`, lessonId, authorId, parentId, body, isHidden: false, createdAt: at, author: null };
    this.comments.push(comment);
    return this.view(comment);
  }

  /**
   * Removes a comment and its replies.
   *
   * @param commentId The comment.
   */
  async deleteComment(commentId: string) {
    for (let index = this.comments.length - 1; index >= 0; index--) {
      const comment = this.comments[index];
      if (comment?.id === commentId || comment?.parentId === commentId) this.comments.splice(index, 1);
    }
  }

  /**
   * Hides or shows a comment.
   *
   * @param commentId The comment.
   * @param isHidden Whether students stop seeing it.
   * @returns False for an unknown comment.
   */
  async setHidden(commentId: string, isHidden: boolean) {
    const comment = this.comments.find(({ id }) => id === commentId);
    if (comment) comment.isHidden = isHidden;
    return comment !== undefined;
  }

  /**
   * Lists threads for the inbox, with a placeholder lesson and course.
   *
   * @param query The filter and window.
   * @param query.isUnansweredOnly Whether only threads without a staff reply are listed.
   * @param query.limit Threads to return.
   * @param query.offset Threads to skip.
   * @returns The window's threads and how many match.
   */
  async listInbox({ isUnansweredOnly, limit, offset }: { isUnansweredOnly: boolean; limit: number; offset: number }) {
    const threads: InboxThread[] = this.threads(this.comments.filter((comment) => comment.parentId === null).reverse(), true)
      .map((thread) => ({
        ...thread,
        lesson: { id: thread.lessonId, title: thread.lessonId },
        course: { slug: "course", title: "Course" },
        isAnswered: thread.replies.some((reply) => reply.author?.isStaff),
      }))
      .filter((thread) => !isUnansweredOnly || !thread.isAnswered);
    return { threads: threads.slice(offset, offset + limit), total: threads.length };
  }
}
