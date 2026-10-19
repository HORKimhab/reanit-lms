import type { Clock } from "../auth";
import { InvalidMediaKeyError, MediaNotUploadedError } from "./errors";
import type { ObjectStorage } from "./ports";

/** How long a presigned upload URL works. */
export const UPLOAD_TTL_SECONDS = 15 * 60;
const MS_PER_SECOND = 1000;

/** A file the browser is about to PUT straight to storage. */
interface UploadObject {
  key: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Builds the steps every direct-to-storage file shares (lesson files, school logos): presign the
 * PUT, check the uploaded key before saving it, and sign downloads with their expiry.
 *
 * @param dependencies Storage and clock.
 * @param dependencies.storage Object storage.
 * @param dependencies.clock Source of the current time, for expiry times.
 * @returns The upload operations.
 * @example
 * const uploads = createUploads({ storage, clock });
 * const upload = await uploads.presignUpload({ key, contentType: "image/png", sizeBytes: 2048 });
 */
export function createUploads({ storage, clock }: { storage: ObjectStorage; clock: Clock }) {
  /**
   * Says when a URL made now with the given lifetime stops working.
   *
   * @param seconds Lifetime.
   * @returns The expiry time.
   */
  function expiresIn(seconds: number): Date {
    return new Date(clock.now().getTime() + seconds * MS_PER_SECOND);
  }

  return {
    /**
     * Presigns a PUT of one file.
     *
     * @param object The file and the key it goes to.
     * @returns The key, where and how to PUT the file, and when the URL expires.
     */
    async presignUpload(object: UploadObject) {
      const upload = await storage.presignUpload(object, UPLOAD_TTL_SECONDS);
      return { key: object.key, ...upload, expiresAt: expiresIn(UPLOAD_TTL_SECONDS) };
    },

    /**
     * Checks that a key the browser sends back is under the owner's prefix and was uploaded.
     *
     * @param key The key the upload went to.
     * @param prefix The prefix the owner's files live under, ending in a slash.
     * @throws {InvalidMediaKeyError} When the key is outside the prefix.
     * @throws {MediaNotUploadedError} When nothing has been uploaded under the key.
     */
    async assertUploaded(key: string, prefix: string): Promise<void> {
      if (!key.startsWith(prefix) || key.includes("..")) throw new InvalidMediaKeyError();
      if (!(await storage.exists(key))) throw new MediaNotUploadedError();
    },

    /**
     * Signs a URL to download a file.
     *
     * @param key The file's key.
     * @param ttlSeconds How long the URL works.
     * @returns The URL and when it expires.
     */
    async signDownload(key: string, ttlSeconds: number): Promise<{ url: string; expiresAt: Date }> {
      return { url: await storage.presignDownload(key, ttlSeconds), expiresAt: expiresIn(ttlSeconds) };
    },
  };
}

/** The direct-to-storage file steps. */
export type Uploads = ReturnType<typeof createUploads>;
