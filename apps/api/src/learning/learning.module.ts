import { Module } from "@nestjs/common";
import { createCertificateService, createCommentModeration, createLearningService } from "@reanit/core/learning";
import type { ObjectStorage } from "@reanit/core/media";
import { createCatalogStore, createCertificateStore, createCommentStore, createLearningStore, createQuizStore, type DbClient } from "@reanit/db";
import { DB_CLIENT, OBJECT_STORAGE } from "@reanit/nest";

import { systemClock } from "../context/clock";
import { MediaModule } from "../media/media.module";
import { MEDIA_FOR_SCHOOL, type MediaForSchool } from "../media/media.tokens";
import { SchoolsModule } from "../schools/schools.module";
import { CertificateTemplateController } from "./certificate-template.controller";
import { CertificatesController } from "./certificates.controller";
import { CommentsController } from "./comments.controller";
import { LearningController } from "./learning.controller";
import { QuizzesController } from "./quizzes.controller";
import {
  CERTIFICATES_FOR_SCHOOL,
  COMMENT_MODERATION_FOR_SCHOOL,
  LEARNING_FOR_SCHOOL,
  type CertificatesForSchool,
  type CommentModerationForSchool,
  type LearningForSchool,
} from "./learning.tokens";

/**
 * Wires per-school learning services to Postgres (tenant client) and the school's lesson files.
 *
 * @param db The shared database client.
 * @param mediaFor Builds a media service limited to one school.
 * @returns A factory of learning services limited to one school.
 */
function provideLearningForSchool(db: DbClient, mediaFor: MediaForSchool): LearningForSchool {
  return (schoolId) =>
    createLearningService({
      catalog: createCatalogStore(db, schoolId),
      store: createLearningStore(db, schoolId),
      quizzes: createQuizStore(db, schoolId),
      comments: createCommentStore(db, schoolId),
      media: mediaFor(schoolId),
      clock: systemClock,
    });
}

/**
 * Wires per-school comment moderation to Postgres (tenant client).
 *
 * @param db The shared database client.
 * @returns A factory of the staff side of comments, limited to one school.
 */
function provideCommentModerationForSchool(db: DbClient): CommentModerationForSchool {
  return (schoolId) => createCommentModeration({ store: createCommentStore(db, schoolId), clock: systemClock });
}

/**
 * Wires per-school certificates to Postgres (tenant client) and object storage, which holds their PDFs.
 *
 * @param db The shared database client.
 * @param storage Signs students' downloads.
 * @returns A factory of certificate services limited to one school.
 */
function provideCertificatesForSchool(db: DbClient, storage: ObjectStorage): CertificatesForSchool {
  return (schoolId) => createCertificateService({ store: createCertificateStore(db, schoolId), storage, clock: systemClock });
}

/** The student player (course access, lesson files, progress, quizzes, comments, certificates), the quiz builder, comment moderation, certificate checks and templates. */
@Module({
  imports: [SchoolsModule, MediaModule],
  controllers: [LearningController, QuizzesController, CommentsController, CertificatesController, CertificateTemplateController],
  providers: [
    { provide: LEARNING_FOR_SCHOOL, inject: [DB_CLIENT, MEDIA_FOR_SCHOOL], useFactory: provideLearningForSchool },
    { provide: COMMENT_MODERATION_FOR_SCHOOL, inject: [DB_CLIENT], useFactory: provideCommentModerationForSchool },
    { provide: CERTIFICATES_FOR_SCHOOL, inject: [DB_CLIENT, OBJECT_STORAGE], useFactory: provideCertificatesForSchool },
  ],
})
export class LearningModule {}
