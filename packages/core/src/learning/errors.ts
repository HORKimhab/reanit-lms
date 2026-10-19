/** The student has no current enrollment in the course (never enrolled, or it expired), or the lesson is not in one. */
export class NotEnrolledError extends Error {
  override readonly name = "NotEnrolledError";
}

/** The school has no such lesson, it is not a quiz, or its quiz has no questions yet. */
export class QuizNotFoundError extends Error {
  override readonly name = "QuizNotFoundError";
}

/** The drip lesson is not open to the student yet; `unlocksAt` says when it opens. */
export class LessonLockedError extends Error {
  override readonly name = "LessonLockedError";

  /**
   * Records when the lesson opens.
   *
   * @param unlocksAt The moment it opens for this student.
   */
  constructor(readonly unlocksAt: Date) {
    super(`Lesson opens at ${unlocksAt.toISOString()}`);
  }
}

/** The school has no such comment, or students cannot see it. */
export class CommentNotFoundError extends Error {
  override readonly name = "CommentNotFoundError";
}

/** Only a comment's author may delete it. */
export class NotCommentAuthorError extends Error {
  override readonly name = "NotCommentAuthorError";
}
