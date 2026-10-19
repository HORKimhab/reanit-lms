import type { Clock } from "../auth";
import { LessonMediaMissingError, LessonNotFoundError, MediaTooLargeError, UnsupportedMediaError } from "./errors";
import type { LessonMedia, LessonMediaStore, ObjectStorage } from "./ports";
import { holdsMedia, lessonMediaPrefix, MEDIA_RULES, mediaExtension, type UploadRequest } from "./rules";
import { createUploads } from "./uploads";

/** How long a playback URL works; long enough to watch a long lesson without the player refreshing it. */
export const PLAYBACK_TTL_SECONDS = 4 * 60 * 60;

/** What `createMediaService` needs. */
export interface MediaDependencies {
  /** The school whose lessons these are. */
  schoolId: string;
  lessons: LessonMediaStore;
  storage: ObjectStorage;
  clock: Clock;
  /** Makes the unique part of a new file's key. */
  newId: () => string;
}

/**
 * Builds one school's lesson media use cases: upload a file straight to storage, attach it, play it.
 *
 * @param dependencies School, stores, storage, clock and id generator.
 * @param dependencies.schoolId The school whose lessons these are.
 * @param dependencies.lessons The school's lessons.
 * @param dependencies.storage Object storage.
 * @param dependencies.clock Source of the current time.
 * @param dependencies.newId Makes the unique part of a new file's key.
 * @returns Upload, attach and playback operations.
 * @example
 * const media = createMediaService({ schoolId, lessons: createLessonMediaStore(db, schoolId), storage, clock, newId: randomUUID });
 */
export function createMediaService({ schoolId, lessons, storage, clock, newId }: MediaDependencies) {
  const uploads = createUploads({ storage, clock });

  /**
   * Loads a lesson of this school.
   *
   * @param lessonId The lesson's id.
   * @returns The lesson.
   * @throws {LessonNotFoundError} When the school has no such lesson.
   */
  async function requireLesson(lessonId: string): Promise<LessonMedia> {
    const lesson = await lessons.findLesson(lessonId);
    if (!lesson) throw new LessonNotFoundError();
    return lesson;
  }

  return {
    /**
     * Presigns an upload of a lesson's file, so the browser sends it straight to storage.
     *
     * @param lessonId The lesson.
     * @param request The file, as the browser describes it.
     * @param request.contentType Its content type.
     * @param request.sizeBytes Its size in bytes.
     * @returns Where and how to PUT the file, the key to attach afterwards, and when the URL expires.
     * @throws {LessonNotFoundError} When the school has no such lesson.
     * @throws {UnsupportedMediaError} When the lesson's type does not take that kind of file.
     * @throws {MediaTooLargeError} When the file is over the limit for its kind.
     */
    async requestUpload(lessonId: string, { contentType, sizeBytes }: UploadRequest) {
      const lesson = await requireLesson(lessonId);
      const extension = mediaExtension(lesson.type, contentType);
      if (!holdsMedia(lesson.type) || !extension) throw new UnsupportedMediaError();
      if (sizeBytes > MEDIA_RULES[lesson.type].maxBytes) throw new MediaTooLargeError();
      return uploads.presignUpload({ key: `${lessonMediaPrefix(schoolId, lessonId)}${newId()}.${extension}`, contentType, sizeBytes });
    },

    /**
     * Makes an uploaded file the lesson's content, replacing any earlier one.
     *
     * @param lessonId The lesson.
     * @param key The key `requestUpload` returned.
     * @throws {LessonNotFoundError} When the school has no such lesson.
     * @throws {InvalidMediaKeyError} When the key is not one of this lesson's.
     * @throws {MediaNotUploadedError} When nothing has been uploaded under the key.
     */
    async attachMedia(lessonId: string, key: string): Promise<void> {
      await requireLesson(lessonId);
      await uploads.assertUploaded(key, lessonMediaPrefix(schoolId, lessonId));
      await lessons.setMediaKey(lessonId, key);
    },

    /**
     * Signs a URL to play or download a lesson's file.
     *
     * @param lessonId The lesson.
     * @returns The URL and when it expires.
     * @throws {LessonNotFoundError} When the school has no such lesson.
     * @throws {LessonMediaMissingError} When no file is attached.
     */
    async getPlaybackUrl(lessonId: string): Promise<{ url: string; expiresAt: Date }> {
      const { mediaKey } = await requireLesson(lessonId);
      if (!mediaKey) throw new LessonMediaMissingError();
      return uploads.signDownload(mediaKey, PLAYBACK_TTL_SECONDS);
    },
  };
}

/** One school's lesson media use cases. */
export type MediaService = ReturnType<typeof createMediaService>;
