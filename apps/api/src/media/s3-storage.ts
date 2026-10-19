import { HeadObjectCommand, NotFound, PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStorage } from "@reanit/core/media";

import type { Env } from "../config/env";

/** Headers a presigned upload is signed with; the browser must send the same values. */
const SIGNED_UPLOAD_HEADERS = new Set(["content-type", "content-length"]);

/** The S3 settings the adapter reads. */
type S3Env = Pick<
  Env,
  "S3_ENDPOINT" | "S3_PUBLIC_ENDPOINT" | "S3_REGION" | "S3_BUCKET" | "S3_ACCESS_KEY_ID" | "S3_SECRET_ACCESS_KEY" | "S3_FORCE_PATH_STYLE"
>;

/**
 * Creates an S3 client for one endpoint.
 *
 * @param env S3 settings.
 * @param endpoint The endpoint to call, or undefined for AWS.
 * @returns The client.
 */
function s3Client(env: S3Env, endpoint: string | undefined) {
  return new S3Client({
    endpoint,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
}

/**
 * `ObjectStorage` on any S3-compatible service (R2, S3, SeaweedFS locally). Uploads and downloads go straight
 * between the browser and the bucket; the server only signs URLs and checks that a file arrived.
 *
 * @param env S3 settings.
 * @returns The storage.
 */
export function createS3Storage(env: S3Env): ObjectStorage {
  const client = s3Client(env, env.S3_ENDPOINT);
  // Presigned URLs carry the host they were signed for, so sign with the one browsers can reach.
  const signer = env.S3_PUBLIC_ENDPOINT ? s3Client(env, env.S3_PUBLIC_ENDPOINT) : client;
  const Bucket = env.S3_BUCKET;

  return {
    /**
     * Signs a PUT of exactly this type and size, so the browser cannot upload something else.
     *
     * @param object What to upload.
     * @param object.key Its key.
     * @param object.contentType Its content type.
     * @param object.sizeBytes Its size in bytes.
     * @param expiresInSeconds URL lifetime.
     * @returns The URL and the header the browser must send (it sets Content-Length itself).
     */
    async presignUpload({ key, contentType, sizeBytes }, expiresInSeconds) {
      const command = new PutObjectCommand({ Bucket, Key: key, ContentType: contentType, ContentLength: sizeBytes });
      const url = await getSignedUrl(signer, command, { expiresIn: expiresInSeconds, signableHeaders: SIGNED_UPLOAD_HEADERS });
      return { url, headers: { "content-type": contentType } };
    },

    /**
     * Signs a GET of a file.
     *
     * @param key The file's key.
     * @param expiresInSeconds URL lifetime.
     * @returns The URL.
     */
    presignDownload(key, expiresInSeconds) {
      return getSignedUrl(signer, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: expiresInSeconds });
    },

    /**
     * Checks that a file is in the bucket.
     *
     * @param key The file's key.
     * @returns True when it exists.
     * @throws {Error} When storage fails for another reason than a missing file.
     */
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return true;
      } catch (error) {
        if (error instanceof NotFound) return false;
        throw error;
      }
    },
  };
}
