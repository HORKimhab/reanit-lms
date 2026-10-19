import { parseEnv } from "./config/env";
import { setUpBucket } from "./media/bucket-setup";
import { s3Client } from "./media/s3-storage";

/**
 * `pnpm storage:setup`: creates the media bucket if needed and allows the web app's origin to
 * upload and play files from the browser. Run once per environment (local SeaweedFS, staging and production R2).
 *
 * @throws {z.ZodError} When the environment is invalid.
 * @throws {Error} When storage refuses the calls.
 */
async function main() {
  const env = parseEnv(process.env);
  const origin = new URL(env.APP_URL).origin;
  const { isCreated } = await setUpBucket(s3Client(env, env.S3_ENDPOINT), env.S3_BUCKET, [origin]);
  process.stdout.write(`Bucket ${env.S3_BUCKET} ${isCreated ? "created" : "already existed"}; CORS allows ${origin}.\n`);
}

await main();
