/** The student has no current enrollment in the course (never enrolled, or it expired), or the lesson is not in one. */
export class NotEnrolledError extends Error {
  override readonly name = "NotEnrolledError";
}
