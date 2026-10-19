/** The school has no lesson with the given id. */
export class LessonNotFoundError extends Error {
  override readonly name = "LessonNotFoundError";
}

/** The file type does not fit the lesson (e.g. a PDF for a video lesson, or any file for a text lesson). */
export class UnsupportedMediaError extends Error {
  override readonly name = "UnsupportedMediaError";
}

/** The file is bigger than its kind allows. */
export class MediaTooLargeError extends Error {
  override readonly name = "MediaTooLargeError";
}

/** The storage key does not belong to this lesson, so it cannot be attached to it. */
export class InvalidMediaKeyError extends Error {
  override readonly name = "InvalidMediaKeyError";
}

/** Nothing has been uploaded under the key yet. */
export class MediaNotUploadedError extends Error {
  override readonly name = "MediaNotUploadedError";
}

/** The lesson has no file attached to play. */
export class LessonMediaMissingError extends Error {
  override readonly name = "LessonMediaMissingError";
}
