import type { LearningService } from "@reanit/core/learning";

/** Injection token for `LearningForSchool`. */
export const LEARNING_FOR_SCHOOL = Symbol("LEARNING_FOR_SCHOOL");

/** Builds one school's learning service on the tenant client. */
export type LearningForSchool = (schoolId: string) => LearningService;
