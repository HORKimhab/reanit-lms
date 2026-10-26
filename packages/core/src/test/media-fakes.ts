// In-memory fakes of the media ports, for unit tests of the media service.
import type { LessonMedia, LessonMediaStore, ObjectStorage } from "../media";

/** In-memory `LessonMediaStore` for one school, whose lessons tests can inspect. */
export class FakeLessonMediaStore implements LessonMediaStore {
  readonly lessons = new Map<string, LessonMedia>();

  /**
   * Finds a lesson.
   *
   * @param lessonId The lesson's id.
   * @returns The lesson, or null.
   */
  async findLesson(lessonId: string) {
    return this.lessons.get(lessonId) ?? null;
  }

  /**
   * Records the attached file.
   *
   * @param lessonId The lesson's id.
   * @param mediaKey The file's key.
   */
  async setMediaKey(lessonId: string, mediaKey: string) {
    const lesson = this.lessons.get(lessonId);
    if (lesson) this.lessons.set(lessonId, { ...lesson, mediaKey });
  }
}

/** Fake storage: presigned URLs spell out what was signed; `uploaded` lists keys that exist, `stored` what the server put. */
export class FakeObjectStorage implements ObjectStorage {
  readonly uploaded = new Set<string>();
  readonly stored = new Map<string, { contentType: string; body: Uint8Array }>();

  /**
   * Fakes a presigned upload.
   *
   * @param object What to upload.
   * @param object.key Its key.
   * @param object.contentType Its content type.
   * @param object.sizeBytes Its size.
   * @param expiresInSeconds URL lifetime.
   * @returns A URL naming the key and lifetime, with the headers to send.
   */
  async presignUpload({ key, contentType, sizeBytes }: { key: string; contentType: string; sizeBytes: number }, expiresInSeconds: number) {
    return {
      url: `https://storage.test/${key}?upload&expires=${expiresInSeconds}`,
      headers: { "content-type": contentType, "content-length": String(sizeBytes) },
    };
  }

  /**
   * Fakes a signed download URL.
   *
   * @param key The file's key.
   * @param expiresInSeconds URL lifetime.
   * @returns A URL naming the key and lifetime.
   */
  async presignDownload(key: string, expiresInSeconds: number) {
    return `https://storage.test/${key}?download&expires=${expiresInSeconds}`;
  }

  /**
   * Tells whether a file was uploaded.
   *
   * @param key The file's key.
   * @returns True when the key is in `uploaded`.
   */
  async exists(key: string) {
    return this.uploaded.has(key);
  }

  /**
   * Keeps a file the server stored.
   *
   * @param object The file.
   * @param object.key Its key.
   * @param object.contentType Its content type.
   * @param object.body Its bytes.
   */
  async put({ key, contentType, body }: { key: string; contentType: string; body: Uint8Array }) {
    this.uploaded.add(key);
    this.stored.set(key, { contentType, body });
  }

  /**
   * Forgets a file.
   *
   * @param key Its key.
   */
  async remove(key: string) {
    this.uploaded.delete(key);
    this.stored.delete(key);
  }
}
