import type { LessonType } from "../catalog";

/** A lesson as the media module sees it. */
export interface LessonMedia {
  id: string;
  type: LessonType;
  /** Storage key of the attached file; null until one is attached. */
  mediaKey: string | null;
}

/** One school's lessons, for attaching files. `@reanit/db` implements it with `createLessonMediaStore`. */
export interface LessonMediaStore {
  findLesson(lessonId: string): Promise<LessonMedia | null>;
  setMediaKey(lessonId: string, mediaKey: string): Promise<void>;
}

/** A presigned upload: the browser PUTs the file to `url` with exactly these headers. */
export interface PresignedUpload {
  url: string;
  headers: Record<string, string>;
}

/** S3-compatible object storage (R2 in production, SeaweedFS locally). The API and the worker provide it; tests use a fake. */
export interface ObjectStorage {
  presignUpload(object: { key: string; contentType: string; sizeBytes: number }, expiresInSeconds: number): Promise<PresignedUpload>;
  presignDownload(key: string, expiresInSeconds: number): Promise<string>;
  exists(key: string): Promise<boolean>;
  /** Stores a file the server made itself, such as a certificate PDF, replacing any file at that key. */
  put(object: { key: string; contentType: string; body: Uint8Array }): Promise<void>;
  /** Deletes a file; resolves when it is already gone. */
  remove(key: string): Promise<void>;
}
