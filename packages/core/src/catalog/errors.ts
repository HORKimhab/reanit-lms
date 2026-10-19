/** The school has no course with the given id or slug. */
export class CourseNotFoundError extends Error {
  override readonly name = "CourseNotFoundError";
}
