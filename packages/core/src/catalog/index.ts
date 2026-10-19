export { CourseNotFoundError } from "./errors";
export type { CatalogStore, Course, CourseStatus, CourseWithOutline, LessonType } from "./ports";
export {
  COURSE_STATUSES,
  createCourseSchema,
  DESCRIPTION_MAX_LENGTH,
  LESSON_TYPES,
  MAX_UNLOCK_AFTER_DAYS,
  outlineSchema,
  outlineStats,
  TITLE_MAX_LENGTH,
  updateCourseSchema,
  type CreateCourseInput,
  type Outline,
  type UpdateCourseInput,
} from "./rules";
export { createCatalogService, type CatalogService } from "./service";
