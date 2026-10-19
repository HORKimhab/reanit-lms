/** The student has no current enrollment in the course (never enrolled, or it expired), or the lesson is not in one. */
export class NotEnrolledError extends Error {
  override readonly name = "NotEnrolledError";
}

/** The school has no such lesson, it is not a quiz, or its quiz has no questions yet. */
export class QuizNotFoundError extends Error {
  override readonly name = "QuizNotFoundError";
}
