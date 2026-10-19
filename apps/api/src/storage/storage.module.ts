import { Module } from "@nestjs/common";
import type { ObjectStorage } from "@reanit/core/media";
import { ENV } from "@reanit/nest";

import type { Env } from "../config/env";
import { createS3Storage } from "./s3-storage";

/** Injection token for the `ObjectStorage` adapter. */
export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");

/**
 * Connects to the configured S3-compatible storage.
 *
 * @param env Validated environment.
 * @returns The storage adapter.
 */
function provideStorage(env: Env): ObjectStorage {
  return createS3Storage(env);
}

/** S3-compatible object storage for lesson files and school logos. */
@Module({
  providers: [{ provide: OBJECT_STORAGE, inject: [ENV], useFactory: provideStorage }],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
