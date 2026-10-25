import { GetObjectCommand, HeadObjectCommand, NotFound, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Global, Module } from "@nestjs/common";
import type { ObjectStorage } from "@reanit/core/media";
import { z } from "zod";

import { ENV } from "./env";

/** Injection token for the `ObjectStorage` port from `@reanit/core`. */
export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");

/** Headers a presigned upload is signed with; the browser must send the same values. */
const SIGNED_UPLOAD_HEADERS = new Set(["content-type", "content-length"]);

/** Variables an app that reads or writes files adds to its environment. */
export const storageEnvSchema = z.object({
  /** S3 API endpoint the server calls, e.g. http://localhost:8333 for the local SeaweedFS; leave out for AWS S3. */
  S3_ENDPOINT: z.url().optional(),
  /** Endpoint browsers reach, used in presigned URLs when it differs (e.g. the API inside compose); defaults to S3_ENDPOINT. */
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  /** Region; R2 uses "auto". */
  S3_REGION: z.string().min(1).default("auto"),
  /** Bucket holding lesson videos and PDFs, logos and certificates. */
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  /** Local SeaweedFS needs path-style URLs (`endpoint/bucket/key`). */
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
});

/** The S3 settings the adapter reads. */
export type S3Env = z.infer<typeof storageEnvSchema>;

/**
 * Creates an S3 client for one endpoint.
 *
 * @param env S3 settings.
 * @param endpoint The endpoint to call, or undefined for AWS.
 * @returns The client.
 * @example
 * await setUpBucket(s3Client(env, env.S3_ENDPOINT), env.S3_BUCKET, [origin]);
 */
export function s3Client(env: S3Env, endpoint: string | undefined) {
  return new S3Client({
    endpoint,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
}

/**
 * `ObjectStorage` on any S3-compatible service (R2, S3, SeaweedFS locally). Uploads and downloads go straight
 * between the browser and the bucket; the server signs URLs, checks that a file arrived, and stores the files it makes.
 *
 * @param env S3 settings.
 * @returns The storage.
 * @example
 * await createS3Storage(env).put({ key, contentType: "application/pdf", body: pdf });
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

    /**
     * Uploads a file from the server.
     *
     * @param object The file.
     * @param object.key Its key.
     * @param object.contentType Its content type.
     * @param object.body Its bytes.
     * @throws {Error} When storage refuses it.
     */
    async put({ key, contentType, body }) {
      await client.send(new PutObjectCommand({ Bucket, Key: key, ContentType: contentType, Body: body }));
    },
  };
}

/**
 * Connects to the configured S3-compatible storage.
 *
 * @param env Validated environment; it must include `storageEnvSchema`.
 * @returns The storage adapter.
 */
function provideStorage(env: S3Env): ObjectStorage {
  return createS3Storage(env);
}

/** Provides S3-compatible object storage (lesson files, logos, certificates) to every module; the app's environment must include `storageEnvSchema`. */
@Global()
@Module({
  providers: [{ provide: OBJECT_STORAGE, inject: [ENV], useFactory: provideStorage }],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
