import { CreateBucketCommand, HeadBucketCommand, NotFound, PutBucketCorsCommand, type S3Client } from "@aws-sdk/client-s3";

/** How long browsers may cache the CORS preflight. */
const PREFLIGHT_MAX_AGE_SECONDS = 3600;

/**
 * Prepares the media bucket: creates it when missing and lets the web app's origin PUT
 * uploads and GET playback straight from the browser (CORS). Safe to run again.
 *
 * @param client S3 client with rights to create and configure buckets.
 * @param bucket The bucket's name.
 * @param origins Browser origins that upload and play files, e.g. the web app's.
 * @returns Whether the bucket had to be created.
 * @throws {Error} When storage refuses the calls.
 */
export async function setUpBucket(client: S3Client, bucket: string, origins: string[]): Promise<{ isCreated: boolean }> {
  let isCreated = false;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (error) {
    if (!(error instanceof NotFound)) throw error;
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    isCreated = true;
  }
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          { AllowedOrigins: origins, AllowedMethods: ["PUT", "GET"], AllowedHeaders: ["content-type"], MaxAgeSeconds: PREFLIGHT_MAX_AGE_SECONDS },
        ],
      },
    }),
  );
  return { isCreated };
}
