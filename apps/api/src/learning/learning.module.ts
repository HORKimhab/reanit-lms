import { Module } from "@nestjs/common";
import { createLearningService } from "@reanit/core/learning";
import { createCatalogStore, createLearningStore, createQuizStore, type DbClient } from "@reanit/db";
import { DB_CLIENT } from "@reanit/nest";

import { systemClock } from "../context/clock";
import { MediaModule } from "../media/media.module";
import { MEDIA_FOR_SCHOOL, type MediaForSchool } from "../media/media.tokens";
import { SchoolsModule } from "../schools/schools.module";
import { LearningController } from "./learning.controller";
import { QuizzesController } from "./quizzes.controller";
import { LEARNING_FOR_SCHOOL, type LearningForSchool } from "./learning.tokens";

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
      media: mediaFor(schoolId),
      clock: systemClock,
    });
}

/** The student player (course access, lesson files, progress, quizzes) and the quiz builder. */
@Module({
  imports: [SchoolsModule, MediaModule],
  controllers: [LearningController, QuizzesController],
  providers: [{ provide: LEARNING_FOR_SCHOOL, inject: [DB_CLIENT, MEDIA_FOR_SCHOOL], useFactory: provideLearningForSchool }],
})
export class LearningModule {}
