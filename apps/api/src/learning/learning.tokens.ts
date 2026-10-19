import type { CommentModeration, LearningService } from "@reanit/core/learning";

/** Injection token for `LearningForSchool`. */
export const LEARNING_FOR_SCHOOL = Symbol("LEARNING_FOR_SCHOOL");

/** Builds one school's learning service on the tenant client. */
export type LearningForSchool = (schoolId: string) => LearningService;

/** Injection token for `CommentModerationForSchool`. */
export const COMMENT_MODERATION_FOR_SCHOOL = Symbol("COMMENT_MODERATION_FOR_SCHOOL");

/** Builds one school's staff side of lesson comments on the tenant client. */
export type CommentModerationForSchool = (schoolId: string) => CommentModeration;
