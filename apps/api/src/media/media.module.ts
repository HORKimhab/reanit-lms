import { randomUUID } from "node:crypto";

import { Module } from "@nestjs/common";
import { createMediaService, type ObjectStorage } from "@reanit/core/media";
import { createLessonMediaStore, type DbClient } from "@reanit/db";
import { DB_CLIENT, ENV } from "@reanit/nest";

import type { Env } from "../config/env";
import { SchoolsModule } from "../schools/schools.module";
import { MediaController } from "./media.controller";
import { MEDIA_FOR_SCHOOL, OBJECT_STORAGE, type MediaForSchool } from "./media.tokens";
import { createS3Storage } from "./s3-storage";

/** The real clock. */
const systemClock = {
  /**
   * Reads the system time.
   *
   * @returns The current time.
   */
  now: () => new Date(),
};

/**
 * Wires per-school media services to Postgres (tenant client) and object storage.
 *
 * @param db The shared database client.
 * @param storage Object storage.
 * @returns A factory of media services limited to one school.
 */
function provideMediaForSchool(db: DbClient, storage: ObjectStorage): MediaForSchool {
  return (schoolId) =>
    createMediaService({ schoolId, lessons: createLessonMediaStore(db, schoolId), storage, clock: systemClock, newId: randomUUID });
}

/**
 * Connects to the configured S3-compatible storage.
 *
 * @param env Validated environment.
 * @returns The storage adapter.
 */
function provideStorage(env: Env): ObjectStorage {
  return createS3Storage(env);
}

/** Lesson file uploads and previews for staff. */
@Module({
  imports: [SchoolsModule],
  controllers: [MediaController],
  providers: [
    { provide: OBJECT_STORAGE, inject: [ENV], useFactory: provideStorage },
    { provide: MEDIA_FOR_SCHOOL, inject: [DB_CLIENT, OBJECT_STORAGE], useFactory: provideMediaForSchool },
  ],
})
export class MediaModule {}
